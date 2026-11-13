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
    const deleteList = (JSON.parse(event.body).deleteList || []).map(Number);
    if (deleteList.length === 0 || deleteList.some((id) => !Number.isInteger(id))) {
      return { statusCode: 400, body: JSON.stringify({ error: "deleteList must be bike ids" }), headers };
    }
    await client.connect();
    const res = await client.query("DELETE FROM bike WHERE bike_id = ANY($1::bigint[])", [deleteList]);
    console.log("deleted bikes", deleteList, "rows", res.rowCount);
    return { statusCode: 200, body: JSON.stringify(res.rows), headers };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "deleteBike failed" }), headers };
  } finally {
    await client.end().catch(() => {});
  }
};
