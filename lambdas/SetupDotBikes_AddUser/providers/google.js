// Google sign-in. The app gets an OAuth access token from Google in the browser (@react-oauth/google)
// and sends it here; we ask Google who it belongs to.

// The app's Google OAuth client id (public, also in src/index.tsx).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ||
  "347941074448-vqvn1gsthtvt4jj8u7ojnoqme16jh0h5.apps.googleusercontent.com";

// The person behind the access token (input.token, or input.accessToken as the app sends it), or
// null if it isn't a valid token issued to this app for a verified email address.
async function verify(input) {
  const accessToken = input.token ?? input.accessToken;
  if (!accessToken || typeof accessToken !== "string") return null;
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
  if (!profile.sub || !profile.email || profile.email_verified === false) return null;
  return {
    subject: String(profile.sub),
    email: profile.email,
    firstName: profile.given_name || "",
    lastName: profile.family_name || ""
  };
}

module.exports = { name: "google", verify };
