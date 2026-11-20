// POST /checkout   body: {"token": "...", "interval": "month" | "year"}
// Creates a Stripe Checkout session for Pro and returns its URL. The browser redirects
// there; Stripe sends the user back to the app afterwards. The webhook, not this function,
// turns Pro on once payment succeeds.
const { Client } = require("pg");
const jwt = require("jsonwebtoken");
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
// Billing rollout switch: BILLING_ENABLED_FOR is "all" or a comma-separated list of user ids.
// Users not on it keep today's behaviour: no bike limit, no Go Pro.
const billingEnabledFor = (userId) => {
  const v = (process.env.BILLING_ENABLED_FOR || "").trim();
  return v === "all" || v.split(",").map((s) => s.trim()).includes(String(userId));
};

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

const PRICE_LOOKUP_KEYS = { month: "pro_monthly", year: "pro_yearly" };

const newClient = () => new Client({
  host: process.env.NEON_HOSTNAME,
  user: process.env.NEON_USERNAME,
  password: process.env.NEON_PASSWORD,
  database: process.env.NEON_DATABASE
});

const userIdFrom = (token) => {
  if (!token || !process.env.JWT) return null;
  try {
    const id = Number(jwt.verify(token, process.env.JWT, { algorithms: ["HS256"] }).app_user_id);
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
  const userId = userIdFrom(body.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });
  if (!billingEnabledFor(userId)) return reply(403, { error: "Pro isn't available yet", code: "BILLING_DISABLED" });
  const lookupKey = PRICE_LOOKUP_KEYS[body.interval];
  if (!lookupKey) return reply(400, { error: "interval must be month or year" });
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error("STRIPE_SECRET_KEY is not set");
    return reply(500, { error: "Payments aren't set up yet" });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const client = newClient();
  try {
    await client.connect();
    const { rows } = await client.query(
      "SELECT email_address, plan, stripe_customer_id FROM app_user WHERE app_user_id = $1",
      [userId]
    );
    if (rows.length === 0) return reply(401, { error: "Please sign in again" });
    const user = rows[0];
    if (user.plan === "pro") return reply(409, { error: "You're already on Pro", code: "ALREADY_PRO" });
    const customerId = await usableCustomer(stripe, client, userId, user.stripe_customer_id);

    const prices = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
    if (prices.data.length === 0) {
      console.error("No active Stripe price with lookup key", lookupKey);
      return reply(500, { error: "Payments aren't set up yet" });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: prices.data[0].id, quantity: 1 }],
      // Lets the webhook match the payment to this user.
      client_reference_id: String(userId),
      // Reuse the Stripe customer if they've paid before; otherwise prefill their email.
      ...(customerId
        ? { customer: customerId }
        : { customer_email: user.email_address }),
      subscription_data: { metadata: { app_user_id: String(userId) } },
      metadata: { app_user_id: String(userId) },
      allow_promotion_codes: true,
      success_url: `${APP_URL}/?checkout=success`,
      cancel_url: `${APP_URL}/?checkout=cancel`
    });
    console.log("checkout session for user", userId, body.interval);
    return reply(200, { url: session.url });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "Couldn't start checkout" });
  } finally {
    await client.end().catch(() => {});
  }
};
