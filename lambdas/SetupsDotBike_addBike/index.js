const { Client } = require("pg");
const jwt = require("jsonwebtoken");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

const newClient = () => new Client({
  host: process.env.RDS_HOSTNAME,
  user: process.env.RDS_USERNAME,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE
});

exports.handler = async (event) => {
  const client = newClient();
  try {
    const { token, brand, model } = event.queryStringParameters || {};
    const tokenId = jwt.verify(token, process.env.JWT);
    await client.connect();
    const res = await client.query(
      "INSERT INTO bike (app_user_id, brand, model) VALUES ($1, $2, $3)",
      [tokenId.app_user_id, brand, model]
    );
    console.log("added bike for user", tokenId.app_user_id);
    return { statusCode: 200, body: JSON.stringify(res.rows), headers };
  } catch (err) {
    console.error(err);
    const status = err.name === "JsonWebTokenError" ? 401 : 500;
    return { statusCode: status, body: JSON.stringify({ error: "addBike failed" }), headers };
  } finally {
    await client.end().catch(() => {});
  }
};
