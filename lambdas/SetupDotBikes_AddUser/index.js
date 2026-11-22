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

// Sign-in for every method: the provider modules in ./providers check the credential, and this
// file finds or creates the account and issues the app token. See providers/index.js.
const getProvider = require("./providers");
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

// The account for a verified person from a provider, creating or linking it as needed, in one
// transaction:
//   1. This provider id is already known: that account.
//   2. Otherwise an account with the same (provider-verified) email exists: link this method to it.
//      This also fills in Google's id on the rows migration 011 backfilled without one, and
//      replaces a provider id that changed for the same verified address.
//   3. Otherwise: a new account with this method.
async function accountFor(client, provider, person, query) {
  await client.query("BEGIN");
  try {
    let res = await client.query(
      `UPDATE auth_identity SET last_used_at = now()
        WHERE provider = $1 AND provider_subject = $2
        RETURNING app_user_id`,
      [provider, person.subject]
    );
    let userId = res.rows[0] && res.rows[0].app_user_id;
    let isNew = false;

    if (!userId) {
      // Look the account up first. INSERT ... ON CONFLICT draws a new id from the sequence
      // on every call, even when the row already exists, so it is only run for new accounts.
      const byEmail = "SELECT app_user_id FROM app_user WHERE lower(email_address) = lower($1) ORDER BY app_user_id LIMIT 1";
      res = await client.query(byEmail, [person.email]);
      userId = res.rows[0] && res.rows[0].app_user_id;
      if (!userId) {
        res = await client.query(
          `INSERT INTO app_user (first_name, last_name, email_address,
                                 signup_source, signup_medium, signup_campaign, signup_ref)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (email_address) DO NOTHING
           RETURNING app_user_id, signup_source`,
          [person.firstName, person.lastName, person.email, ...signupSource(query)]
        );
        if (res.rows.length) {
          userId = res.rows[0].app_user_id;
          isNew = true;
          console.log("new user", userId, "via", provider, "source", res.rows[0].signup_source || "-");
        } else {
          // Two first sign-ins at the same moment: the other one inserted the row.
          userId = (await client.query(byEmail, [person.email])).rows[0].app_user_id;
        }
      }
      res = await client.query(
        `INSERT INTO auth_identity (app_user_id, provider, provider_subject, email, last_used_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (app_user_id, provider)
         DO UPDATE SET provider_subject = EXCLUDED.provider_subject, email = EXCLUDED.email,
                       last_used_at = now()
         RETURNING (xmax = 0) AS added`,
        [userId, provider, person.subject, person.email]
      );
      console.log(res.rows[0].added ? "linked" : "updated", provider, "identity for user", userId);
    }

    const user = (await client.query("SELECT * FROM app_user WHERE app_user_id = $1", [userId])).rows[0];
    await client.query("COMMIT");
    return { user, isNew };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  }
}

const appToken = async (u, secret) =>
  new (await jose).SignJWT({
    app_user_id: u.app_user_id,
    first_name: u.first_name,
    last_name: u.last_name,
    email_address: u.email_address
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_LIFETIME)
    .sign(new TextEncoder().encode(secret));

// action "setName": a signed-in person sets their name (new email sign-ups have none). Returns a
// fresh app token, since the token carries the name.
const NAME = (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, " ").slice(0, 100) : "");
async function setName(client, query, secret) {
  let claims;
  try {
    claims = (await (await jose).jwtVerify(String(query.token || ""), new TextEncoder().encode(secret))).payload;
  } catch {
    return reply(401, { error: "Sign in again" });
  }
  const first = NAME(query.firstName);
  if (!first) return reply(400, { error: "Enter your first name" });
  await client.connect();
  const res = await client.query(
    "UPDATE app_user SET first_name = $2, last_name = $3 WHERE app_user_id = $1 RETURNING *",
    [claims.app_user_id, first, NAME(query.lastName)]
  );
  if (!res.rows.length) return reply(401, { error: "Sign in again" });
  console.log("name set for user", claims.app_user_id);
  return reply(200, { token: await appToken(res.rows[0], secret) });
}

const clientIp = (event) => {
  const ctx = event.requestContext || {};
  return (ctx.identity && ctx.identity.sourceIp) || (ctx.http && ctx.http.sourceIp) || null;
};

exports.handler = async (event) => {
  const secret = process.env.JWT;
  if (!secret) {
    console.error("JWT env var is not set");
    return reply(500, { error: "addUser failed" });
  }

  const client = newClient();

  try {
    // ?accessToken=... is how the app signs in with Google. Other methods send provider and their
    // fields (as query parameters or a JSON body): email sends { provider: "email", email } with
    // action "requestCode", then { provider: "email", email, code }.
    let body = {};
    try { body = event.body ? JSON.parse(event.body) : {}; } catch { body = {}; }
    const query = { ...(event.queryStringParameters || {}), ...(body && typeof body === "object" ? body : {}) };
    if (query.action === "setName") return await setName(client, query, secret);

    const provider = getProvider(query.provider || "google");
    if (!provider) return reply(400, { error: "Unknown sign-in method" });
    const ctx = { db: client, ip: clientIp(event) };

    if (query.action === "requestCode") {
      if (!provider.requestCode) return reply(400, { error: "Unknown sign-in method" });
      await client.connect();
      const out = await provider.requestCode(query, ctx);
      return reply(out.status, out.body);
    }

    await client.connect();
    const person = await provider.verify(query, ctx);
    if (!person) return reply(401, { error: "Sign-in could not be verified" });

    const { user: u, isNew } = await accountFor(client, provider.name, person, query);
    const token = await appToken(u, secret);
    console.log("signed in user", u.app_user_id, "via", provider.name);
    return reply(200, { token, isNew });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "addUser failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
