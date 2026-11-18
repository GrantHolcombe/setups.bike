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

const newClient = () => new Client({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE
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

// Columns the app may update. Column names are fixed here, never taken from the request.
const COLUMNS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_tokens", "rear_tire", "rear_sus_pressure",
  "rear_sus_comp_1", "rear_sus_comp_2", "rear_sus_comp_count",
  "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count", "rear_tokens"
];

// Missing, empty or anything that isn't a number (an emptied input, "NaN") means "leave this
// column as it is". Real settings are whole numbers and can't be negative, so anything else
// is rounded and floored at 0.
const toValue = (v) => {
  if (v === undefined || v === null || v === "" || v === "NaN" || v === "null") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(99999, Math.max(0, Math.round(n)));
};

exports.handler = async (event) => {
  const data = event.queryStringParameters || {};
  const userId = userIdFrom(data.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });

  const client = newClient();
  try {
    const sets = COLUMNS.map((c, i) => `${c} = COALESCE($${i + 1}, ${c})`).join(",\n        ");
    const values = COLUMNS.map((c) => toValue(data[c]));
    values.push(data.bike_id, userId);

    await client.connect();
    // Only updates the bike if it belongs to the signed-in user.
    const res = await client.query(
      `UPDATE bike SET
        ${sets}
      WHERE bike_id = $${COLUMNS.length + 1} AND app_user_id = $${COLUMNS.length + 2}`,
      values
    );
    if (res.rowCount === 0) return reply(404, { error: "Bike not found" });
    return reply(200, res.rows);
  } catch (err) {
    console.error(err);
    return reply(500, { error: "updateBike failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
