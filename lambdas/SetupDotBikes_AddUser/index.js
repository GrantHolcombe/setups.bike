const { Client } = require("pg");
const jwt = require("jsonwebtoken");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

// The app's Google OAuth client id (public, also in src/index.tsx).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
  "347941074448-vqvn1gsthtvt4jj8u7ojnoqme16jh0h5.apps.googleusercontent.com";
const TOKEN_LIFETIME = "7d";

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

// Ask Google who the access token belongs to. Returns null if it isn't a valid token
// issued to this app for a verified email address.
async function googleUser(accessToken) {
  if (!accessToken) return null;
  const info = await fetch(
    "https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(accessToken)
  );
  if (!info.ok) return null;
  const tokenInfo = await info.json();
  if (tokenInfo.aud !== GOOGLE_CLIENT_ID && tokenInfo.azp !== GOOGLE_CLIENT_ID) return null;

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + accessToken }
  });
  if (!res.ok) return null;
  const profile = await res.json();
  if (!profile.email || profile.email_verified === false) return null;
  return profile;
}

exports.handler = async (event) => {
  const secret = process.env.JWT;
  if (!secret) {
    console.error("JWT env var is not set");
    return reply(500, { error: "addUser failed" });
  }

  const client = new Client({
    host: process.env.RDS_HOSTNAME,
    user: process.env.RDS_USERNAME,
    password: process.env.RDS_PASSWORD,
    database: process.env.RDS_DATABASE
  });

  try {
    const profile = await googleUser((event.queryStringParameters || {}).accessToken);
    if (!profile) return reply(401, { error: "Google sign-in could not be verified" });

    await client.connect();
    // Look the user up first. INSERT ... ON CONFLICT draws a new id from the sequence
    // on every call, even when the row already exists, so it is only run for new users.
    const select = "SELECT * FROM app_user WHERE email_address = $1";
    let res = await client.query(select, [profile.email]);
    if (res.rows.length === 0) {
      res = await client.query(
        `INSERT INTO app_user (first_name, last_name, email_address)
         VALUES ($1, $2, $3)
         ON CONFLICT (email_address) DO NOTHING
         RETURNING *`,
        [profile.given_name || "", profile.family_name || "", profile.email]
      );
      // Two first logins at the same moment: the other one inserted the row.
      if (res.rows.length === 0) res = await client.query(select, [profile.email]);
    }

    const u = res.rows[0];
    const token = jwt.sign(
      {
        app_user_id: u.app_user_id,
        first_name: u.first_name,
        last_name: u.last_name,
        email_address: u.email_address
      },
      secret,
      { algorithm: "HS256", expiresIn: TOKEN_LIFETIME }
    );
    console.log("signed in user", u.app_user_id);
    return reply(200, { token });
  } catch (err) {
    console.error(err);
    return reply(500, { error: "addUser failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
