const { Client } = require("pg");
const jwt = require("jsonwebtoken");

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

// The signed-in user, from the token AddUser issued. Returns null if the token is
// missing, expired or not signed with our secret.
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
  const { token, brand, model } = event.queryStringParameters || {};
  const userId = userIdFrom(token);
  if (userId === null) return reply(401, { error: "Please sign in again" });

  const client = newClient();
  try {
    await client.connect();

    // Free plan: up to FREE_BIKE_LIMIT bikes. Users already over the limit keep their bikes
    // but can't add more until they're on Pro.
    const { rows } = await client.query(
      `SELECT u.plan, (SELECT count(*) FROM bike b WHERE b.app_user_id = u.app_user_id)::int AS bikes
         FROM app_user u WHERE u.app_user_id = $1`,
      [userId]
    );
    if (rows.length === 0) return reply(401, { error: "Please sign in again" });
    if (billingEnabledFor(userId) && rows[0].plan !== "pro" && rows[0].bikes >= FREE_BIKE_LIMIT) {
      return reply(403, {
        error: `The free plan holds ${FREE_BIKE_LIMIT} bikes. Go Pro for unlimited bikes.`,
        code: "FREE_LIMIT",
        limit: FREE_BIKE_LIMIT
      });
    }

    const res = await client.query(
      "INSERT INTO bike (app_user_id, brand, model) VALUES ($1, $2, $3)",
      [userId, brand, model]
    );
    console.log("added bike for user", userId);
    return reply(200, res.rows);
  } catch (err) {
    console.error(err);
    return reply(500, { error: "addBike failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
