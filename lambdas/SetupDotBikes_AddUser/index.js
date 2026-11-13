const { Client } = require("pg");
const jwt = require('jsonwebtoken');

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
    database: process.env.RDS_DATABASE,
  });

  try {
    const { firstName, lastName, emailAddress } = event.queryStringParameters || {};
    await client.connect();

    // Look the user up first. INSERT ... ON CONFLICT draws a new id from the sequence
    // on every call, even when the row already exists, so it is only run for new users.
    const select = 'SELECT * FROM app_user WHERE email_address = $1';
    let res = await client.query(select, [emailAddress]);
    if (res.rows.length === 0) {
      res = await client.query(
        `INSERT INTO app_user (first_name, last_name, email_address)
         VALUES ($1, $2, $3)
         ON CONFLICT (email_address) DO NOTHING
         RETURNING *`,
        [firstName, lastName, emailAddress]
      );
      // Two first logins at the same moment: the other one inserted the row.
      if (res.rows.length === 0) res = await client.query(select, [emailAddress]);
    }

    const token = jwt.sign(res.rows[0], "shid&fard");
    console.log('decoded ', res.rows[0].app_user_id);
    return { statusCode: 200, body: JSON.stringify({ token }), headers };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: 'addUser failed' }), headers };
  } finally {
    await client.end().catch(() => {});
  }
};
