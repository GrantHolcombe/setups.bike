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

// Columns the app may update. Column names are fixed here, never taken from the request.
const COLUMNS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_tokens", "rear_tire", "rear_sus_pressure",
  "rear_sus_comp_1", "rear_sus_comp_2", "rear_sus_comp_count",
  "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count", "rear_tokens"
];

// Missing, empty or "NaN" (an emptied number input) means "leave this column as it is".
const toValue = (v) => (v === undefined || v === "" || v === "NaN" || v === "null" ? null : v);

exports.handler = async (event) => {
  const client = newClient();
  try {
    const data = event.queryStringParameters || {};
    const sets = COLUMNS.map((c, i) => `${c} = COALESCE($${i + 1}, ${c})`).join(",\n        ");
    const values = COLUMNS.map((c) => toValue(data[c]));
    values.push(data.bike_id);

    await client.connect();
    const res = await client.query(
      `UPDATE bike SET
        ${sets}
      WHERE bike_id = $${COLUMNS.length + 1}`,
      values
    );
    return { statusCode: 200, body: JSON.stringify(res.rows), headers };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "updateBike failed" }), headers };
  } finally {
    await client.end().catch(() => {});
  }
};
