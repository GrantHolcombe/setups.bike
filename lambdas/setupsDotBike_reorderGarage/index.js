const { Client } = require("pg");

const headers = {
  'Content-Type': 'application/json',
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

exports.handler = async (event) => {
  const client = new Client({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE
  });

  try {
    const dataArray = JSON.parse(event.body).bikeList || [];
    if (dataArray.length === 0) {
      return { statusCode: 200, body: JSON.stringify('true'), headers };
    }

    await client.connect();
    // One statement, one round trip. A single UPDATE is atomic, so no BEGIN/COMMIT is needed.
    await client.query(
      `UPDATE garage_order AS g
          SET garage_order = v.garage_order
         FROM unnest($1::bigint[], $2::int[]) AS v(bike_id, garage_order)
        WHERE g.bike_id = v.bike_id`,
      [dataArray.map(i => i.bike_id), dataArray.map(i => i.garage_order)]
    );
    return { statusCode: 200, body: JSON.stringify('true'), headers };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify('false'), headers };
  } finally {
    // Close the connection so the function can finish as soon as the work is done.
    await client.end().catch(() => {});
  }
};
