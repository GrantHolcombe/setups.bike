// POST /portal   body: {"token": "..."}
// Opens Stripe's Customer Portal for the signed-in user (update card, invoices,
// switch monthly/yearly, cancel at period end) and returns its short-lived URL.
const { Client } = require("pg");
// jose (not jsonwebtoken): no dependencies, works on Node 24 and 26. It is an ES module, and
// Lambda's Node runtime can't require() one, so it is loaded with import() once per cold start.
const jose = import("jose");
const Stripe = require("stripe");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

const APP_URL = (process.env.APP_URL || "https://setups.bike").replace(/\/$/, "");

// A stored Stripe customer can stop existing: a sandbox customer after switching to live
// keys, or a deleted test customer. Treat it as "no customer yet" and clear the stale ids,
// instead of failing.
async function usableCustomer(stripe, db, userId, customerId) {
  if (!customerId) return null;
  try {
    const c = await stripe.customers.retrieve(customerId);
    if (!c.deleted) return customerId;
  } catch (err) {
    if (err.code !== "resource_missing") throw err;
  }
  await db.query(
    "UPDATE app_user SET stripe_customer_id = NULL, stripe_subscription_id = NULL WHERE app_user_id = $1 AND stripe_customer_id = $2",
    [userId, customerId]
  );
  console.warn("cleared stale Stripe customer for user", userId);
  return null;
}

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

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Bad request" });
  }
  const userId = await userIdFrom(body.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    return reply(500, { error: "Payments aren't set up yet" });
  }

  const client = newClient();
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT stripe_customer_id FROM app_user WHERE app_user_id = $1",
      [userId]
    );
    if (rows.length === 0) return reply(401, { error: "Please sign in again" });
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customerId = await usableCustomer(stripe, client, userId, rows[0].stripe_customer_id);
    if (!customerId) {
      return reply(404, { error: "No subscription to manage yet", code: "NO_BILLING" });
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${APP_URL}/?portal=return`
    });
    return reply(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't open billing" });
  } finally {
    await client.end().catch(() => {});
  }
};
