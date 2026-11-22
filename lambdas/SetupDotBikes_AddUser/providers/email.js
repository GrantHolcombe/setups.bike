// Email sign-in with a one-time code (card "Sign-in 2"). Decided 2026-11-22: a 6-digit code sent
// through Resend, no passwords.
//
//   requestCode({ email }, ctx)  -> { status, body }   sends a code (always the same answer whether
//                                                      or not the address has an account)
//   verify({ email, code }, ctx) -> person | null      checks it; the address becomes the identity
//
// Codes live in email_login_code (migration 012): hashed, 10 minutes, one use, 5 guesses, and a
// new code expires the older ones. The email is plain text only, so Resend's open and click
// tracking (on for mail.setups.bike) adds nothing to it.

const crypto = require("crypto");

const CODE_MINUTES = 10;
const MAX_GUESSES = 5;
// Rate limits on sending: per address and per requesting IP.
const LIMITS = { emailPer15Min: 3, emailPerDay: 10, ipPerHour: 10 };
const FROM = process.env.SIGNIN_EMAIL_FROM || "Setups.Bike <signin@mail.setups.bike>";
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalize = (email) => (typeof email === "string" ? email.trim().toLowerCase() : "");
const validEmail = (email) => email.length <= 254 && EMAIL.test(email);
const hash = (email, code) =>
  crypto.createHmac("sha256", process.env.JWT).update(`${email}:${code}`).digest("hex");

async function sendCode(email, code) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "User-Agent": "setups-bike/1.0"
    },
    body: JSON.stringify({
      from: FROM,
      to: [email],
      subject: `${code} is your Setups.Bike sign-in code`,
      text:
        `Your Setups.Bike sign-in code is ${code}\n\n` +
        `Enter it on the sign-in screen within ${CODE_MINUTES} minutes. It works once.\n\n` +
        `If you didn't ask to sign in, you can ignore this email; nobody can get in without the code.\n\n` +
        `Setups.Bike - https://setups.bike`
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status} ${(await res.text()).slice(0, 200)}`);
}

async function requestCode(input, { db, ip }) {
  const email = normalize(input.email);
  if (!validEmail(email)) return { status: 400, body: { error: "Enter a valid email address" } };

  const counts = (await db.query(
    `SELECT count(*) FILTER (WHERE email = $1 AND created_at > now() - interval '15 minutes') AS email_15m,
            count(*) FILTER (WHERE email = $1 AND created_at > now() - interval '1 day') AS email_day,
            count(*) FILTER (WHERE request_ip = $2 AND created_at > now() - interval '1 hour') AS ip_hour
       FROM email_login_code
      WHERE created_at > now() - interval '1 day' AND (email = $1 OR request_ip = $2)`,
    [email, ip || null]
  )).rows[0];
  if (Number(counts.email_15m) >= LIMITS.emailPer15Min || Number(counts.email_day) >= LIMITS.emailPerDay ||
      (ip && Number(counts.ip_hour) >= LIMITS.ipPerHour)) {
    console.log("email code rate limited");
    return { status: 429, body: { error: "Too many codes requested. Wait a few minutes and try again." } };
  }

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await db.query("DELETE FROM email_login_code WHERE created_at < now() - interval '1 day'");
  await db.query(
    "UPDATE email_login_code SET expires_at = now() WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()",
    [email]
  );
  await db.query(
    `INSERT INTO email_login_code (email, code_hash, request_ip, expires_at)
     VALUES ($1, $2, $3, now() + make_interval(mins => $4::int))`,
    [email, hash(email, code), ip || null, CODE_MINUTES]
  );
  try {
    await sendCode(email, code);
  } catch (err) {
    console.error("sign-in code email failed", String(err));
    return { status: 502, body: { error: "We couldn't send the email. Try again in a minute." } };
  }
  console.log("sign-in code sent");
  return { status: 200, body: { sent: true } };
}

async function verify(input, { db }) {
  const email = normalize(input.email);
  const code = typeof input.code === "string" ? input.code.replace(/\s+/g, "") : "";
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return null;

  // Count the guess first (atomically), then compare: at most MAX_GUESSES tries per code.
  const row = (await db.query(
    `UPDATE email_login_code SET attempts = attempts + 1
      WHERE email_login_code_id = (
              SELECT email_login_code_id FROM email_login_code
               WHERE email = $1 AND consumed_at IS NULL AND expires_at > now()
               ORDER BY created_at DESC LIMIT 1)
        AND attempts < $2
      RETURNING email_login_code_id, code_hash`,
    [email, MAX_GUESSES]
  )).rows[0];
  if (!row) return null;
  const expected = Buffer.from(row.code_hash, "hex");
  const given = Buffer.from(hash(email, code), "hex");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  // Use it up; a second request with the same code gets nothing.
  const used = await db.query(
    "UPDATE email_login_code SET consumed_at = now() WHERE email_login_code_id = $1 AND consumed_at IS NULL RETURNING 1",
    [row.email_login_code_id]
  );
  if (!used.rows.length) return null;
  return { subject: email, email, firstName: "", lastName: "" };
}

module.exports = { name: "email", requestCode, verify };
