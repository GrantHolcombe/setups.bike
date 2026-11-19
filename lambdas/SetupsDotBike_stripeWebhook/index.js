// POST /stripeWebhook   (called by Stripe, not the app)
// Keeps app_user's plan in step with the user's Stripe subscription.
//
// Safety rules:
//   - Every event's Stripe-Signature is checked against the raw body with
//     STRIPE_WEBHOOK_SECRET. Anything that fails is rejected with 400.
//   - Each event id is recorded in stripe_event in the same transaction as the update,
//     so a repeated delivery is ignored and a failed one is retried by Stripe.
//   - The subscription is always re-read from Stripe instead of trusting the event's copy,
//     so events arriving out of order can't leave a stale plan behind.
const { Client } = require("pg");
const Stripe = require("stripe");

const json = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
  headers: { "Content-Type": "application/json" }
});

const newClient = () => new Client({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE
});

// Statuses that keep Pro. past_due keeps it while Stripe retries the card; if every retry
// fails, Stripe cancels the subscription and the deleted event moves the user to Free.
const PRO_STATUSES = new Set(["active", "trialing", "past_due"]);

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed"
]);

const header = (headers, name) => {
  const key = Object.keys(headers || {}).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
};

// Works with both older (invoice.subscription) and newer (invoice.parent...) API shapes.
const subscriptionIdFrom = (event) => {
  const o = event.data.object;
  if (event.type.startsWith("customer.subscription.")) return o.id;
  if (event.type === "checkout.session.completed") return o.subscription;
  if (event.type.startsWith("invoice.")) {
    return o.subscription || o.parent?.subscription_details?.subscription || null;
  }
  return null;
};

// current_period_end moved from the subscription to its items in newer API versions.
const periodEnd = (sub) => sub.current_period_end || sub.items?.data?.[0]?.current_period_end || null;

async function syncSubscription(stripe, db, subscriptionId, hintUserId) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

  // Find the user: by customer id first, then the app_user_id we put on the checkout.
  let { rows } = await db.query(
    "SELECT app_user_id, stripe_subscription_id, plan_source FROM app_user WHERE stripe_customer_id = $1",
    [customerId]
  );
  if (rows.length === 0) {
    const id = Number(hintUserId || sub.metadata?.app_user_id);
    if (Number.isInteger(id)) {
      ({ rows } = await db.query(
        "SELECT app_user_id, stripe_subscription_id, plan_source FROM app_user WHERE app_user_id = $1",
        [id]
      ));
    }
  }
  if (rows.length === 0) {
    console.warn("No user for subscription", sub.id, "customer", customerId);
    return;
  }
  const user = rows[0];

  // Comped accounts (free Pro, set by hand) are never changed by Stripe.
  if (user.plan_source === "comp") {
    console.log("Ignoring subscription", sub.id, "for comped user", user.app_user_id);
    return;
  }

  // An old, finished subscription mustn't overwrite a newer one.
  if (user.stripe_subscription_id && user.stripe_subscription_id !== sub.id && !PRO_STATUSES.has(sub.status)) {
    console.log("Ignoring old subscription", sub.id, "for user", user.app_user_id);
    return;
  }

  const isPro = PRO_STATUSES.has(sub.status);
  const end = periodEnd(sub);
  await db.query(
    `UPDATE app_user SET
        plan = $2,
        plan_source = 'stripe',
        plan_status = $3,
        plan_interval = $4,
        plan_renews_at = $5,
        plan_cancel_at_period_end = $6,
        plan_updated_at = now(),
        stripe_customer_id = $7,
        stripe_subscription_id = $8
      WHERE app_user_id = $1`,
    [
      user.app_user_id,
      isPro ? "pro" : "free",
      sub.status,
      sub.items?.data?.[0]?.price?.recurring?.interval || null,
      end ? new Date(end * 1000) : null,
      Boolean(sub.cancel_at_period_end || sub.cancel_at),
      customerId,
      sub.id
    ]
  );
  console.log("user", user.app_user_id, "->", isPro ? "pro" : "free", `(${sub.status})`);
}

exports.handler = async (event) => {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("Stripe env vars are not set");
    return json(500, { error: "not configured" });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const raw = event.isBase64Encoded ? Buffer.from(event.body || "", "base64") : event.body || "";
  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(
      raw,
      header(event.headers, "stripe-signature"),
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.warn("Rejected webhook:", err.message);
    return json(400, { error: "bad signature" });
  }

  if (!HANDLED.has(stripeEvent.type)) return json(200, { ignored: stripeEvent.type });

  const db = newClient();
  try {
    await db.connect();
    await db.query("BEGIN");
    const seen = await db.query(
      "INSERT INTO stripe_event (event_id, event_type) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING 1",
      [stripeEvent.id, stripeEvent.type]
    );
    if (seen.rowCount === 0) {
      await db.query("ROLLBACK");
      return json(200, { duplicate: stripeEvent.id });
    }

    const subscriptionId = subscriptionIdFrom(stripeEvent);
    if (subscriptionId) {
      const hint = stripeEvent.type === "checkout.session.completed"
        ? stripeEvent.data.object.client_reference_id
        : null;
      await syncSubscription(stripe, db, subscriptionId, hint);
    }
    await db.query("COMMIT");
    console.log("handled", stripeEvent.type, stripeEvent.id);
    return json(200, { received: true });
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    console.error("Webhook failed, Stripe will retry:", stripeEvent.type, stripeEvent.id, err);
    return json(500, { error: "processing failed" });
  } finally {
    await db.end().catch(() => {});
  }
};
