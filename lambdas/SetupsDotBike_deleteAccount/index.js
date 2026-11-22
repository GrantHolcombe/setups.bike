// POST /deleteAccount   body: {"token": "...", "confirm": "delete"}
// Deletes the signed-in user's account and everything it owns, from the app's menu (card "Sign-in 4";
// Apple's App Store rule 5.1.1(v) requires in-app deletion). Same result as
// db/maintenance/delete_user.sql, in this order:
//   1. Stripe: an active subscription is cancelled now (no refund; see the Refund Policy). If that
//      fails, nothing is deleted, so nobody keeps paying for an account that's gone. The Stripe
//      customer is kept, as Stripe keeps payment records for tax and accounting anyway.
//   2. Each sign-in method's cleanup (see PROVIDER_CLEANUP; nothing for Google or email, Apple's
//      token revoke lands with card "Sign-in 3").
//   3. One transaction: the bikes (their saved setups, ride notes, share links and garage positions
//      go with them through ON DELETE CASCADE), leftover garage_order and shared_setup rows, unused
//      email sign-in codes, then the app_user row (auth_identity goes with it).
//   4. Resend: the contact is removed. A failure is logged, not shown: the account is already gone.
// "confirm" must be "delete" (the dialog makes the person type it). Deleting an account that's
// already gone answers 200, so a retry after a dropped connection is harmless.
const { Client } = require("pg");
const Stripe = require("stripe");
const jose = import("jose");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};
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

// Per sign-in method cleanup when an account is deleted. Apple requires revoking its token
// (https://appleid.apple.com/auth/revoke) when someone deletes an account they made with Sign in
// with Apple; card "Sign-in 3" fills that in. Google and email need nothing.
const PROVIDER_CLEANUP = {
  google: null,
  email: null,
  apple: async (identity) => {
    console.warn("TODO (Sign-in 3): revoke the Apple token for", identity.provider_subject ? "an Apple identity" : "-");
  }
};

const STOPPED = new Set(["canceled", "incomplete_expired"]);

async function cancelSubscription(subscriptionId) {
  if (!subscriptionId) return "none";
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  let sub;
  try {
    sub = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err) {
    if (err && err.code === "resource_missing") return "missing"; // e.g. a sandbox id after going live
    throw err;
  }
  if (STOPPED.has(sub.status)) return "already stopped";
  await stripe.subscriptions.cancel(subscriptionId);
  return "cancelled";
}

async function removeResendContact(email) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !email) return "skipped";
  const res = await fetch("https://api.resend.com/contacts/" + encodeURIComponent(email), {
    method: "DELETE",
    headers: { Authorization: `Bearer ${key}`, "User-Agent": "setups-bike/1.0" }
  });
  if (res.ok || res.status === 404) return res.ok ? "removed" : "not on Resend";
  throw new Error(`Resend ${res.status} ${(await res.text()).slice(0, 200)}`);
}

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch { body = {}; }

  let userId;
  try {
    const { payload } = await (await jose).jwtVerify(String(body.token || ""), new TextEncoder().encode(process.env.JWT));
    userId = Number(payload.app_user_id);
  } catch {
    return reply(401, { error: "Sign in again" });
  }
  if (!Number.isInteger(userId)) return reply(401, { error: "Sign in again" });
  if (String(body.confirm || "").trim().toLowerCase() !== "delete") {
    return reply(400, { error: 'Type "delete" to confirm' });
  }

  const client = newClient();
  try {
    await client.connect();
    const user = (await client.query(
      "SELECT app_user_id, email_address, stripe_subscription_id FROM app_user WHERE app_user_id = $1",
      [userId]
    )).rows[0];
    if (!user) {
      console.log("delete: user", userId, "already gone");
      return reply(200, { deleted: true });
    }

    try {
      console.log("delete: user", userId, "subscription", await cancelSubscription(user.stripe_subscription_id));
    } catch (err) {
      console.error("delete: Stripe cancel failed for user", userId, String(err));
      return reply(502, { error: "We couldn't cancel your Pro subscription, so nothing was deleted. Try again in a minute." });
    }

    const identities = (await client.query(
      "SELECT provider, provider_subject FROM auth_identity WHERE app_user_id = $1", [userId]
    )).rows;
    for (const identity of identities) {
      const cleanup = PROVIDER_CLEANUP[identity.provider];
      if (cleanup) await cleanup(identity);
    }

    await client.query("BEGIN");
    let counts;
    try {
      const bikes = await client.query("DELETE FROM bike WHERE app_user_id = $1", [userId]);
      await client.query("DELETE FROM garage_order WHERE app_user_id = $1", [userId]);
      await client.query("DELETE FROM shared_setup WHERE app_user_id = $1", [userId]);
      await client.query("DELETE FROM email_login_code WHERE email = lower($1)", [user.email_address]);
      await client.query("DELETE FROM app_user WHERE app_user_id = $1", [userId]);
      await client.query("COMMIT");
      counts = { bikes: bikes.rowCount, signInMethods: identities.length };
    } catch (err) {
      await client.query("ROLLBACK").catch(() => {});
      throw err;
    }
    console.log("delete: user", userId, "deleted", JSON.stringify(counts));

    try {
      console.log("delete: Resend contact", await removeResendContact(user.email_address));
    } catch (err) {
      console.error("delete: Resend contact not removed for user", userId, String(err));
    }
    return reply(200, { deleted: true });
  } catch (err) {
    console.error("delete failed for user", userId, err);
    return reply(500, { error: "Something went wrong, and your account wasn't deleted. Please try again." });
  } finally {
    await client.end().catch(() => {});
  }
};
