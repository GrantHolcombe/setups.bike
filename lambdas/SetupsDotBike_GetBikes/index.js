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

const newClient = () => new Client({
  host: process.env.NEON_HOSTNAME,
  user: process.env.NEON_USERNAME,
  password: process.env.NEON_PASSWORD,
  database: process.env.NEON_DATABASE
});

// The signed-in user, from the token AddUser issued. Returns null if the token is
// missing, expired or not signed with our secret.
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
    const res = await client.query(
      `SELECT * FROM bike b
         JOIN garage_order g ON b.bike_id = g.bike_id
        WHERE b.app_user_id = $1
        ORDER BY g.garage_order`,
      [userId]
    );
    // "last active" for the weekly numbers: at most one write per user per hour, and a failure
    // here never stops the garage from loading
    await client.query(
      `UPDATE app_user SET last_active_at = now()
        WHERE app_user_id = $1 AND (last_active_at IS NULL OR last_active_at < now() - interval '1 hour')`,
      [userId]
    ).catch((err) => console.warn("last_active_at not updated:", err.message));
    return reply(200, res.rows);
  } catch (err) {
    console.error(err);
    return reply(500, { error: "getBikes failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
