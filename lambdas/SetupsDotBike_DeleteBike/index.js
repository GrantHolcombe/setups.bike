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

exports.handler = async (event) => {
  const client = newClient();
  try {
    const body = JSON.parse(event.body || "{}");
    const userId = userIdFrom(body.token);
    if (userId === null) return reply(401, { error: "Please sign in again" });

    const deleteList = (body.deleteList || []).map(Number);
    if (deleteList.length === 0 || deleteList.some((id) => !Number.isInteger(id))) {
      return reply(400, { error: "deleteList must be bike ids" });
    }
    await client.connect();
    // Only deletes bikes that belong to the signed-in user.
    const res = await client.query(
      "DELETE FROM bike WHERE bike_id = ANY($1::bigint[]) AND app_user_id = $2",
      [deleteList, userId]
    );
    console.log("user", userId, "deleted bikes", deleteList, "rows", res.rowCount);
    return reply(200, res.rows);
  } catch (err) {
    console.error(err);
    return reply(500, { error: "deleteBike failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
