const { Client } = require("pg");

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
    const userId = (event.queryStringParameters || {}).userId;
    await client.connect();
    const res = await client.query(
      `SELECT * FROM bike b
         JOIN garage_order g ON b.bike_id = g.bike_id
        WHERE b.app_user_id = $1
        ORDER BY g.garage_order`,
      [userId]
    );
    return { statusCode: 200, body: JSON.stringify(res.rows), headers };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "getBikes failed" }), headers };
  } finally {
    await client.end().catch(() => {});
  }
};
