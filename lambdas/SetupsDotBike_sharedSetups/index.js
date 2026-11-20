// POST /sharedSetups   body: {"action": "...", "token": "...", ...}
// Pro feature 2.3: share a read-only snapshot of a bike's settings by link
// (https://setups.bike/?s=<shareId>). A shared page shows the bike's brand and model, the
// setup name and the settings: never the owner's name or email.
//
// Actions:
//   view    {shareId}             no sign-in   -> the shared snapshot (404 once revoked)
//   preview {shareId}             no sign-in   -> same, for link previews; not counted as a view
//   create  {token, bikeId}       Pro          -> a link for the bike's current settings
//   list    {token}               signed in    -> the user's own links, so they can revoke them
//   revoke  {token, shareId}      signed in    -> hides a link for good
//   copy    {token, shareId}      signed in    -> adds the shared bike to the user's garage;
//                                                counts toward the free plan's bike limit
// Links keep working if the owner's Pro lapses; listing and revoking never need Pro.
const crypto = require("crypto");
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

// The 18 settings a share stores. Column names are fixed here, never taken from the request.
const FIELDS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "front_tokens", "rear_tire", "rear_sus_pressure", "rear_sus_comp_1", "rear_sus_comp_2",
  "rear_sus_comp_count", "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count",
  "rear_tokens"
];
const FREE_BIKE_LIMIT = 3;
const MAX_ACTIVE_LINKS = 100;

const billingEnabledFor = (userId) => {
  const v = (process.env.BILLING_ENABLED_FOR || "").trim();
  return v === "all" || v.split(",").map((s) => s.trim()).includes(String(userId));
};

const newClient = () => new Client({
  host: process.env.NEON_HOSTNAME,
  user: process.env.NEON_USERNAME,
  password: process.env.NEON_PASSWORD,
  database: process.env.NEON_DATABASE
});

const userIdFrom = (token) => {
  if (!token || !process.env.JWT) return null;
  try {
    const id = Number(jwt.verify(token, process.env.JWT, { algorithms: ["HS256"] }).app_user_id);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
};

const asId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const asShareId = (v) => (typeof v === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(v) ? v : null);
// 12 random bytes = 96 bits, 16 URL-safe characters
const newShareId = () => crypto.randomBytes(12).toString("base64url");

const SNAPSHOT = `jsonb_build_object(${FIELDS.map((f) => `'${f}', COALESCE(b.${f}, 0)`).join(", ")})`;
const PUBLIC_COLUMNS = "share_id, brand, model, setup_name, settings, created_at";
const OWNER_COLUMNS = `${PUBLIC_COLUMNS}, bike_id, views, copies`;

async function view(db, _userId, body) {
  const shareId = asShareId(body.shareId);
  if (!shareId) return reply(404, { error: "This shared setup doesn't exist or was removed", code: "NOT_FOUND" });
  const { rows } = await db.query(
    `UPDATE shared_setup SET views = views + 1 WHERE share_id = $1 AND revoked_at IS NULL RETURNING ${PUBLIC_COLUMNS}`,
    [shareId]
  );
  if (rows.length === 0) return reply(404, { error: "This shared setup doesn't exist or was removed", code: "NOT_FOUND" });
  return reply(200, { share: rows[0] });
}

// Same public fields as view, for the link-preview Worker. Doesn't count as a view.
async function preview(db, _userId, body) {
  const shareId = asShareId(body.shareId);
  const { rows } = shareId
    ? await db.query(`SELECT ${PUBLIC_COLUMNS} FROM shared_setup WHERE share_id = $1 AND revoked_at IS NULL`, [shareId])
    : { rows: [] };
  if (rows.length === 0) return reply(404, { error: "Not found", code: "NOT_FOUND" });
  return reply(200, { share: rows[0] });
}

async function create(db, userId, body, user) {
  if (!billingEnabledFor(userId) || user.plan !== "pro") {
    return reply(403, { error: "Sharing setups is a Pro feature", code: "PRO_REQUIRED" });
  }
  const bikeId = asId(body.bikeId);
  const { rows: bikes } = await db.query(
    `SELECT b.brand, b.model, ${SNAPSHOT} AS settings,
            (SELECT s.name FROM bike_setup s WHERE s.bike_setup_id = b.active_setup_id
               AND ${FIELDS.map((x) => `s.${x} = COALESCE(b.${x}, 0)`).join(" AND ")}) AS setup_name
       FROM bike b WHERE b.bike_id = $1 AND b.app_user_id = $2`,
    [bikeId, userId]
  );
  if (bikes.length === 0) return reply(404, { error: "Bike not found" });
  const b = bikes[0];

  // Sharing the same settings again gives back the same link instead of a new one.
  const same = await db.query(
    `SELECT ${OWNER_COLUMNS} FROM shared_setup
      WHERE bike_id = $1 AND revoked_at IS NULL AND settings = $2::jsonb
        AND setup_name IS NOT DISTINCT FROM $3 AND brand = $4 AND model = $5
      ORDER BY created_at DESC LIMIT 1`,
    [bikeId, JSON.stringify(b.settings), b.setup_name, b.brand, b.model]
  );
  if (same.rows.length > 0) return reply(200, { share: same.rows[0], reused: true });

  const active = await db.query(
    "SELECT count(*)::int AS n FROM shared_setup WHERE app_user_id = $1 AND revoked_at IS NULL", [userId]
  );
  if (active.rows[0].n >= MAX_ACTIVE_LINKS) {
    return reply(409, { error: `You can have up to ${MAX_ACTIVE_LINKS} shared links. Remove some first.`, code: "TOO_MANY" });
  }
  const { rows } = await db.query(
    `INSERT INTO shared_setup (share_id, app_user_id, bike_id, brand, model, setup_name, settings)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) RETURNING ${OWNER_COLUMNS}`,
    [newShareId(), userId, bikeId, b.brand, b.model, b.setup_name, JSON.stringify(b.settings)]
  );
  console.log("user", userId, "shared bike", bikeId);
  return reply(200, { share: rows[0] });
}

async function list(db, userId) {
  const { rows } = await db.query(
    `SELECT ${OWNER_COLUMNS} FROM shared_setup WHERE app_user_id = $1 AND revoked_at IS NULL ORDER BY created_at DESC`,
    [userId]
  );
  return reply(200, { shares: rows });
}

async function revoke(db, userId, body) {
  const res = await db.query(
    "UPDATE shared_setup SET revoked_at = now() WHERE share_id = $1 AND app_user_id = $2 AND revoked_at IS NULL",
    [asShareId(body.shareId), userId]
  );
  if (res.rowCount === 0) return reply(404, { error: "Shared link not found" });
  return reply(200, { revoked: body.shareId });
}

async function copy(db, userId, body, user) {
  const { rows: shares } = await db.query(
    `SELECT share_id, brand, model, settings FROM shared_setup WHERE share_id = $1 AND revoked_at IS NULL`,
    [asShareId(body.shareId)]
  );
  if (shares.length === 0) return reply(404, { error: "This shared setup doesn't exist or was removed", code: "NOT_FOUND" });
  const s = shares[0];

  // Same rule as addBike: on the free plan, up to FREE_BIKE_LIMIT bikes.
  if (billingEnabledFor(userId) && user.plan !== "pro" && user.bikes >= FREE_BIKE_LIMIT) {
    return reply(403, {
      error: `The free plan holds ${FREE_BIKE_LIMIT} bikes. Go Pro for unlimited bikes.`,
      code: "FREE_LIMIT",
      limit: FREE_BIKE_LIMIT
    });
  }

  const cols = FIELDS.join(", ");
  const vals = FIELDS.map((f) => `COALESCE(($4::jsonb->>'${f}')::int, 0)`).join(", ");
  // a trigger on bike adds it to the end of the garage order
  const { rows } = await db.query(
    `INSERT INTO bike (app_user_id, brand, model, ${cols}) VALUES ($1, $2, $3, ${vals}) RETURNING bike_id`,
    [userId, s.brand, s.model, JSON.stringify(s.settings)]
  );
  await db.query("UPDATE shared_setup SET copies = copies + 1 WHERE share_id = $1", [s.share_id]);
  console.log("user", userId, "copied a shared setup into bike", rows[0].bike_id);
  return reply(200, { bikeId: rows[0].bike_id });
}

const ACTIONS = { view, preview, create, list, revoke, copy };

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Bad request" });
  }
  const action = ACTIONS[body.action];
  if (!action) return reply(400, { error: "Unknown action" });

  let userId = null;
  if (body.action !== "view" && body.action !== "preview") {
    userId = userIdFrom(body.token);
    if (userId === null) return reply(401, { error: "Please sign in again" });
  }

  const db = newClient();
  try {
    await db.connect();
    let user = null;
    if (userId !== null) {
      const { rows } = await db.query(
        `SELECT u.plan, (SELECT count(*) FROM bike b WHERE b.app_user_id = u.app_user_id)::int AS bikes
           FROM app_user u WHERE u.app_user_id = $1`,
        [userId]
      );
      if (rows.length === 0) return reply(401, { error: "Please sign in again" });
      user = rows[0];
    }
    await db.query("BEGIN");
    const result = await action(db, userId, body, user);
    await db.query(result.statusCode === 200 ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    console.error(err);
    return reply(500, { error: "sharedSetups failed" });
  } finally {
    await db.end().catch(() => {});
  }
};
