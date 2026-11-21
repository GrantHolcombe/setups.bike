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
  const client = newClient();
  try {
    const body = JSON.parse(event.body || "{}");
    const userId = await userIdFrom(body.token);
    if (userId === null) return reply(401, { error: "Please sign in again" });

    const dataArray = body.bikeList || [];
    if (dataArray.length === 0) return reply(200, "true");

    await client.connect();
    // One statement, one round trip, and only for bikes the signed-in user owns.
    // A single UPDATE is atomic, so no BEGIN/COMMIT is needed.
    await client.query(
      `UPDATE garage_order AS g
          SET garage_order = v.garage_order
         FROM unnest($1::bigint[], $2::int[]) AS v(bike_id, garage_order), bike AS b
        WHERE g.bike_id = v.bike_id
          AND b.bike_id = g.bike_id
          AND b.app_user_id = $3`,
      [dataArray.map((i) => i.bike_id), dataArray.map((i) => i.garage_order), userId]
    );
    return reply(200, "true");
  } catch (error) {
    console.error(error);
    return reply(500, "false");
  } finally {
    await client.end().catch(() => {});
  }
};
