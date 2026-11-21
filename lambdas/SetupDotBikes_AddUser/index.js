const { Client } = require("pg");
// jose (not jsonwebtoken): no dependencies, works on Node 24 and 26. It is an ES module, and
// Lambda's Node runtime can't require() one, so it is loaded with import() once per cold start.
const jose = import("jose");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

// The app's Google OAuth client id (public, also in src/index.tsx).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
  "347941074448-vqvn1gsthtvt4jj8u7ojnoqme16jh0h5.apps.googleusercontent.com";
const TOKEN_LIFETIME = "7d";

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

// One database connection per warm Lambda container, reused across calls instead of opening a
// new one every time (saves ~100-200 ms per request). Handlers still call connect()/end() as
// before: connect() reuses the open connection (checking it with a quick SELECT 1 if it has been
// idle for a minute, e.g. Neon paused or the container was frozen), and end() keeps it open.
// A connection-level error marks it broken so the next call reconnects; a query is never retried.
let shared = null;
let lastUsed = 0;
const IDLE_CHECK_MS = 60_000;
const isConnectionError = (err) => !err || !err.code || /^(08|57P0)/.test(err.code) ||
  ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"].includes(err.code);

async function openShared() {
  const c = new Client({
    host: process.env.NEON_HOSTNAME,
    user: process.env.NEON_USERNAME,
    password: process.env.NEON_PASSWORD,
    database: process.env.NEON_DATABASE,
    keepAlive: true
  });
  c.on("error", () => { c.broken = true; }); // the socket died while idle
  await c.connect();
  shared = c;
}

const newClient = () => ({
  async connect() {
    if (shared && !shared.broken && Date.now() - lastUsed > IDLE_CHECK_MS) {
      try {
        await Promise.race([
          shared.query("SELECT 1"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("idle check timed out")), 2000))
        ]);
      } catch {
        shared.broken = true;
      }
    }
    if (!shared || shared.broken) {
      if (shared) shared.end().catch(() => {});
      shared = null;
      await openShared();
    }
    lastUsed = Date.now();
  },
  async query(...args) {
    try {
      return await shared.query(...args);
    } catch (err) {
      if (isConnectionError(err)) shared.broken = true;
      throw err;
    } finally {
      lastUsed = Date.now();
    }
  },
  async end() {
    // keep the connection for the next call on this container
  }
});

// First-touch sign-up source (campaign tags from the link the user arrived through). Saved only
// when the account is created. Anything that isn't a short plain tag is dropped.
const TAG = /^[A-Za-z0-9._~-]{1,64}$/;
const tag = (v) => (typeof v === "string" && TAG.test(v) ? v : null);
const signupSource = (q) => [tag(q.utm_source), tag(q.utm_medium), tag(q.utm_campaign), tag(q.ref)];

// Ask Google who the access token belongs to. Returns null if it isn't a valid token
// issued to this app for a verified email address.
async function googleUser(accessToken) {
  if (!accessToken) return null;
  const info = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(accessToken)
  );
  if (!info.ok) return null;
  const tokenInfo = await info.json();
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID && tokenInfo.azp !== GOOGLE_CLIENT_ID) return null;

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!res.ok) return null;
  const profile = await res.json();
  if (!profile.email || profile.email_verified === false) return null;
  return profile;
}

exports.handler = async (event) => {
  const secret = process.env.JWT;
  if (!secret) {
    console.error("JWT env var is not set");
    return reply(500, { error: "addUser failed" });
  }

  const client = newClient();

  try {
    const query = event.queryStringParameters || {};
    const profile = await googleUser(query.accessToken);
    if (!profile) return reply(401, { error: "Google sign-in could not be verified" });

    await client.connect();
    // Look the user up first. INSERT ... ON CONFLICT draws a new id from the sequence
    // on every call, even when the row already exists, so it is only run for new users.
    const select = "SELECT * FROM app_user WHERE email_address = $1";
    let res = await client.query(select, [profile.email]);
    if (res.rows.length === 0) {
      res = await client.query(
        `INSERT INTO app_user (first_name, last_name, email_address,
                               signup_source, signup_medium, signup_campaign, signup_ref)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (email_address) DO NOTHING
         RETURNING *`,
        [profile.given_name || "", profile.family_name || "", profile.email, ...signupSource(query)]
      );
      if (res.rows.length) console.log("new user", res.rows[0].app_user_id, "source", res.rows[0].signup_source || "-");
      // Two first logins at the same moment: the other one inserted the row.
      if (res.rows.length === 0) res = await client.query(select, [profile.email]);
    }

    const u = res.rows[0];
    const token = await new (await jose).SignJWT({
      app_user_id: u.app_user_id,
      first_name: u.first_name,
      last_name: u.last_name,
      email_address: u.email_address
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(TOKEN_LIFETIME)
      .sign(new TextEncoder().encode(secret));
    console.log("signed in user", u.app_user_id);
    return reply(200, { token });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "addUser failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
