const { Client } = require("pg");
const crypto = require("crypto");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

// POST /resendWebhook   (called by Resend, not the app)
// Keeps the database in step when something changes on Resend's side:
//   contact.updated (unsubscribed true/false) -> marketing_emails follows it   (source: resend)
//   email.bounced (Permanent)                 -> marketing_emails off          (source: bounce)
//   email.complained (marked as spam)         -> marketing_emails off          (source: complaint)
// Every request must carry a valid Resend (Svix) signature made with RESEND_WEBHOOK_SECRET.

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

// Svix signature check: HMAC-SHA256 over "<svix-id>.<svix-timestamp>.<raw body>" with the
// base64-decoded secret (after "whsec_"); the header holds one or more "v1,<base64>" values.
// Requests more than 5 minutes off are refused (replays).
function validSignature(secret, h, rawBody, now = Date.now()) {
  const id = h["svix-id"], ts = h["svix-timestamp"], sig = h["svix-signature"];
  if (!secret || !id || !ts || !sig) return false;
  if (!/^\d+$/.test(ts) || Math.abs(now / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto.createHmac("sha256", key).update(`${id}.${ts}.${rawBody}`).digest();
  return sig.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}
exports.validSignature = validSignature;

// Only writes when the value actually changes, so our own syncs echoing back do nothing.
async function setByEmail(db, email, on, source) {
  if (!email) return 0;
  const { rowCount } = await db.query(
    `UPDATE app_user
        SET marketing_emails = $2, marketing_emails_source = $3, marketing_emails_changed_at = now()
      WHERE lower(email_address) = lower($1) AND marketing_emails IS DISTINCT FROM $2`,
    [email, on, source]
  );
  return rowCount;
}

exports.handler = async (event) => {
  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "");
  const h = Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (!validSignature(process.env.RESEND_WEBHOOK_SECRET, h, raw)) return reply(401, { error: "bad signature" });

  let evt;
  try {
    evt = JSON.parse(raw);
  } catch {
    return reply(400, { error: "bad json" });
  }
  const data = evt.data || {};
  const db = newClient();
  try {
    await db.connect();
    let changed = 0;
    if (evt.type === "contact.updated" && typeof data.unsubscribed === "boolean") {
      changed = await setByEmail(db, data.email, !data.unsubscribed, "resend");
    } else if (evt.type === "email.bounced" && (data.bounce || {}).type === "Permanent") {
      for (const to of data.to || []) changed += await setByEmail(db, to, false, "bounce");
    } else if (evt.type === "email.complained") {
      for (const to of data.to || []) changed += await setByEmail(db, to, false, "complaint");
    }
    console.log("resend webhook", evt.type, "rows changed:", changed);
    return reply(200, { ok: true });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "resendWebhook failed" }); // Resend retries
  } finally {
    await db.end().catch(() => {});
  }
};
