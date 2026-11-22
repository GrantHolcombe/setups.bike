const { Client } = require("pg");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

// POST /emailPrefs   body: {"token": "...", "action": "get" | "set", "on": true|false, "via": "prompt"|"settings"}
// The signed-in user's marketing email preference (news and offers through Resend):
//   get -> {marketingEmails: true | false | null}   (null = never asked; the app shows a prompt)
//   set -> saves it, then updates the user's Resend contact (a Resend failure never fails the save)
// Run by hand (Lambda console "Test", or aws lambda invoke) with {"action": "syncAll"} to copy every
// user's preference to Resend, e.g. right after the Resend key is added. That path isn't reachable
// through API Gateway.
const jose = import("jose");

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

const userIdFrom = async (token) => {
  if (!token || !process.env.JWT) return null;
  try {
    const { payload } = await (await jose).jwtVerify(token, new TextEncoder().encode(process.env.JWT), { algorithms: ["HS256"] });
    const id = Number(payload.app_user_id);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
};

// --- Resend (marketing email provider) ---------------------------------------------------------
// The database is the source of truth; Resend gets a copy so broadcasts reach the right people.
// Needs RESEND_API_KEY (set in the Lambda console, never in the repo) and optionally
// RESEND_SEGMENT_ID (new contacts are added to it). Without the key, syncing is skipped.
// Accounts in EXCLUDED_USER_IDS (e.g. the e2e test account) are never sent to Resend.
const RESEND = "https://api.resend.com";
const excluded = () => (process.env.EXCLUDED_USER_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

async function resendCall(method, path, body) {
  return fetch(RESEND + path, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "User-Agent": "setups-bike/1.0" // Resend rejects requests without one
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(5000)
  });
}

// Creates or updates the contact: subscribed when the user is on the list, unsubscribed if not.
// Resend accepts an email in place of the contact id, but some addresses (e.g. with a "+") come
// back as "id must be a valid UUID"; then we create the contact, or find its id and update by id.
async function findContactId(email) {
  let after;
  for (let page = 0; page < 50; page++) {
    const res = await resendCall("GET", `/contacts?limit=100${after ? `&after=${after}` : ""}`);
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const body = await res.json();
    const hit = (body.data || []).find((c) => (c.email || "").toLowerCase() === email.toLowerCase());
    if (hit) return hit.id;
    if (!body.has_more || !(body.data || []).length) return null;
    after = body.data[body.data.length - 1].id;
  }
  return null;
}

async function syncContact(user) {
  if (!process.env.RESEND_API_KEY) return "skipped (no RESEND_API_KEY)";
  if (excluded().includes(String(user.app_user_id))) return "skipped (excluded account)";
  const unsubscribed = user.marketing_emails !== true;
  const update = { unsubscribed, first_name: user.first_name || undefined };
  const create = async () => {
    const body = { email: user.email_address, first_name: user.first_name || undefined, unsubscribed };
    if (process.env.RESEND_SEGMENT_ID) body.segments = [{ id: process.env.RESEND_SEGMENT_ID }];
    return resendCall("POST", "/contacts", body);
  };

  let res = await resendCall("PATCH", `/contacts/${encodeURIComponent(user.email_address)}`, update);
  if (res.status === 422) {
    // the address wasn't recognised as an email in the URL: create it, or update it by id
    res = await create();
    if (!res.ok) {
      const id = await findContactId(user.email_address);
      if (!id) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
      res = await resendCall("PATCH", `/contacts/${id}`, update);
    }
  } else if (res.status === 404) {
    if (unsubscribed) return "not on Resend; nothing to do";
    res = await create();
  }
  if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return unsubscribed ? "unsubscribed on Resend" : "subscribed on Resend";
}

const USER = "SELECT app_user_id, email_address, first_name, marketing_emails FROM app_user";

async function syncAll(db) {
  const { rows } = await db.query(`${USER} WHERE marketing_emails IS NOT NULL ORDER BY app_user_id`);
  const counts = {};
  for (const u of rows) {
    let result;
    try { result = await syncContact(u); } catch (err) { result = "error"; console.error("sync", u.app_user_id, err.message); }
    counts[result] = (counts[result] || 0) + 1;
    await new Promise((r) => setTimeout(r, 150)); // stay under Resend's 10 requests/second
  }
  console.log("syncAll", JSON.stringify(counts));
  return { users: rows.length, results: counts };
}

exports.handler = async (event) => {
  const db = newClient();
  // manual bulk sync: only a direct invoke (no API Gateway request context) can do this
  if (!event.requestContext && event.action === "syncAll") {
    await db.connect();
    try { return await syncAll(db); } finally { await db.end(); }
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Bad request" });
  }
  const userId = await userIdFrom(body.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });

  try {
    await db.connect();
    if (body.action === "get") {
      const { rows } = await db.query("SELECT marketing_emails FROM app_user WHERE app_user_id = $1", [userId]);
      if (!rows.length) return reply(401, { error: "Please sign in again" });
      return reply(200, { marketingEmails: rows[0].marketing_emails });
    }
    if (body.action === "set") {
      if (typeof body.on !== "boolean") return reply(400, { error: "on must be true or false" });
      const via = body.via === "prompt" ? "prompt" : "settings";
      const { rows } = await db.query(
        `UPDATE app_user
            SET marketing_emails = $2, marketing_emails_source = $3, marketing_emails_changed_at = now()
          WHERE app_user_id = $1
          RETURNING app_user_id, email_address, first_name, marketing_emails`,
        [userId, body.on, via]
      );
      if (!rows.length) return reply(401, { error: "Please sign in again" });
      try {
        console.log("user", userId, "marketing emails", body.on ? "on" : "off", "via", via, "-", await syncContact(rows[0]));
      } catch (err) {
        console.error("user", userId, "Resend sync failed (run syncAll later):", err.message);
      }
      return reply(200, { marketingEmails: rows[0].marketing_emails });
    }
    return reply(400, { error: "Unknown action" });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "emailPrefs failed" });
  } finally {
    await db.end().catch(() => {});
  }
};
