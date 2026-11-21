// GET /account?token=...
// The signed-in user's plan and bike allowance, for the app to show "Go Pro",
// "Manage subscription" and the free-plan limit.
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

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

const FREE_BIKE_LIMIT = 3;

// Billing rollout switch: BILLING_ENABLED_FOR is "all" or a comma-separated list of user ids.
// Users not on it keep today's behaviour: no bike limit, no Go Pro.
const billingEnabledFor = (userId) => {
  const v = (process.env.BILLING_ENABLED_FOR || "").trim();
  return v === "all" || v.split(",").map((s) => s.trim()).includes(String(userId));
};


const newClient = () => new Client({
  host: process.env.NEON_HOSTNAME,
  user: process.env.NEON_USERNAME,
  password: process.env.NEON_PASSWORD,
  database: process.env.NEON_DATABASE
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
  const userId = await userIdFrom((event.queryStringParameters || {}).token);
  if (userId === null) return reply(401, { error: "Please sign in again" });

  const client = newClient();
  try {
    await client.connect();
    const { rows } = await client.query(
      `SELECT u.plan, u.plan_source, u.plan_status, u.plan_interval, u.plan_renews_at,
              u.plan_cancel_at_period_end, u.stripe_customer_id IS NOT NULL AS has_billing,
              (SELECT count(*) FROM bike b WHERE b.app_user_id = u.app_user_id)::int AS bikes
         FROM app_user u WHERE u.app_user_id = $1`,
      [userId]
    );
    if (rows.length === 0) return reply(401, { error: "Please sign in again" });
    const a = rows[0];
    const isPro = a.plan === "pro";
    const billingEnabled = billingEnabledFor(userId);
    const limited = billingEnabled && !isPro;
    return reply(200, {
      plan: a.plan,
      planSource: a.plan_source,
      planStatus: a.plan_status,
      interval: a.plan_interval,
      renewsAt: a.plan_renews_at,
      cancelAtPeriodEnd: a.plan_cancel_at_period_end,
      canManageBilling: a.has_billing && a.plan_source !== "apple" && a.plan_source !== "google",
      bikes: a.bikes,
      billingEnabled,
      bikeLimit: limited ? FREE_BIKE_LIMIT : null,
      canAddBike: !limited || a.bikes < FREE_BIKE_LIMIT
    });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "getAccount failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
