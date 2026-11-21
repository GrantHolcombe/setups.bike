// POST /bikeSetups   body: {"token": "...", "action": "...", ...}
// Pro feature 2.1: named setups (presets) per bike. Names and settings are always the
// user's own; nothing here suggests values.
//
// Actions:
//   list                          -> all of the user's setups, for every bike
//   save    {bikeId, name}        -> snapshot the bike's current settings as a new setup
//   update  {setupId}             -> overwrite a setup with its bike's current settings
//   apply   {setupId}             -> copy a setup onto its bike
//   rename  {setupId, name}
//   delete  {setupId}
// Every action checks the token, that the user is on Pro, and that they own the bike.
const { Client } = require("pg");
// jose (not jsonwebtoken): no dependencies, works on Node 24 and 26. It is an ES module, and
// Lambda's Node runtime can't require() one, so it is loaded with import() once per cold start.
const jose = import("jose");

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Headers": "Content-Type,X-Amz-Date,X-Amz-Security-Token,Authorization,X-Api-Key,X-Requested-With,Accept,Access-Control-Allow-Methods,Access-Control-Allow-Origin,Access-Control-Allow-Headers",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "*",
  "X-Requested-With": "*"
};

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body), headers });

// The 18 settings a setup stores. Column names are fixed here, never taken from the request.
const FIELDS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "front_tokens", "rear_tire", "rear_sus_pressure", "rear_sus_comp_1", "rear_sus_comp_2",
  "rear_sus_comp_count", "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count",
  "rear_tokens"
];
const MAX_SETUPS_PER_BIKE = 20;
const MAX_NAME = 40;

// Billing rollout switch: BILLING_ENABLED_FOR is "all" or a comma-separated list of user ids.
const billingEnabledFor = (userId) => {
  const v = (process.env.BILLING_ENABLED_FOR || "").trim();
  return v === "all" || v.split(",").map((s) => s.trim()).includes(String(userId));
};

// One database connection per warm Lambda container, reused across calls instead of opening a
// new one every time (saves ~100-200 ms per request). Handlers still call connect()/end() as
// before: connect() reuses the open connection (checking it with a quick SELECT 1 if it has been
// idle for a minute, e.g. Neon paused or the container was frozen), and end() keeps it open.
// A connection-level error marks it broken so the next call reconnects; a query is never retried.
let shared = null;
let lastUsed = 0;
const IDLE_CHECK_MS = 60_000;
const isConnectionError = (err) => !err || !err.code || /^(08|57P0)/.test(err.code) ||
  ["ECONNRESET", "EPIPE", "ETIMEDOUT", "ECONNREFUSED"].includes(err.code);

async function openShared() {
  const c = new Client({
    host: process.env.NEON_HOSTNAME,
    user: process.env.NEON_USERNAME,
    password: process.env.NEON_PASSWORD,
    database: process.env.NEON_DATABASE,
    keepAlive: true
  });
  c.on("error", () => { c.broken = true; }); // the socket died while idle
  await c.connect();
  shared = c;
}

const newClient = () => ({
  async connect() {
    if (shared && !shared.broken && Date.now() - lastUsed > IDLE_CHECK_MS) {
      try {
        await Promise.race([
          shared.query("SELECT 1"),
          new Promise((_, reject) => setTimeout(() => reject(new Error("idle check timed out")), 2000))
        ]);
      } catch {
        shared.broken = true;
      }
    }
    if (!shared || shared.broken) {
      if (shared) shared.end().catch(() => {});
      shared = null;
      await openShared();
    }
    lastUsed = Date.now();
  },
  async query(...args) {
    try {
      return await shared.query(...args);
    } catch (err) {
      if (isConnectionError(err)) shared.broken = true;
      throw err;
    } finally {
      lastUsed = Date.now();
    }
  },
  async end() {
    // keep the connection for the next call on this container
  }
});

const userIdFrom = async (token) => {
  if (!token || !process.env.JWT) return null;
  try {
    const { payload } = await (await jose).jwtVerify(token, new TextEncoder().encode(process.env.JWT), { algorithms: ["HS256"] });
    const id = Number(payload.app_user_id);
    return Number.isInteger(id) ? id : null;
  } catch {
    return null;
  }
};

const cleanName = (name) => (typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "");
const asId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);

const COPY_FROM_BIKE = FIELDS.map((f) => `${f} = COALESCE(b.${f}, 0)`).join(", ");
const COPY_FROM_SETUP = FIELDS.map((f) => `${f} = s.${f}`).join(", ");
const SETUP_COLUMNS = ["bike_setup_id", "bike_id", "name", ...FIELDS, "updated_at"].join(", ");

async function list(db, userId) {
  const { rows } = await db.query(
    `SELECT ${SETUP_COLUMNS.split(", ").map((c) => "s." + c).join(", ")}
       FROM bike_setup s JOIN bike b USING (bike_id)
      WHERE b.app_user_id = $1
      ORDER BY s.bike_id, lower(s.name)`,
    [userId]
  );
  return reply(200, { setups: rows });
}

async function save(db, userId, body) {
  const bikeId = asId(body.bikeId);
  const name = cleanName(body.name);
  if (!bikeId) return reply(400, { error: "bikeId is required" });
  if (!name || name.length > MAX_NAME) return reply(400, { error: `Name must be 1 to ${MAX_NAME} characters`, code: "BAD_NAME" });

  const owned = await db.query("SELECT 1 FROM bike WHERE bike_id = $1 AND app_user_id = $2", [bikeId, userId]);
  if (owned.rowCount === 0) return reply(404, { error: "Bike not found" });
  const count = await db.query("SELECT count(*)::int AS n FROM bike_setup WHERE bike_id = $1", [bikeId]);
  if (count.rows[0].n >= MAX_SETUPS_PER_BIKE) {
    return reply(409, { error: `A bike can have up to ${MAX_SETUPS_PER_BIKE} setups`, code: "TOO_MANY" });
  }

  const cols = FIELDS.join(", ");
  const vals = FIELDS.map((f) => `COALESCE(b.${f}, 0)`).join(", ");
  const res = await db.query(
    `INSERT INTO bike_setup (bike_id, name, ${cols})
     SELECT b.bike_id, $3, ${vals} FROM bike b WHERE b.bike_id = $1 AND b.app_user_id = $2
     RETURNING ${SETUP_COLUMNS}`,
    [bikeId, userId, name]
  );
  await db.query("UPDATE bike SET active_setup_id = $1 WHERE bike_id = $2", [res.rows[0].bike_setup_id, bikeId]);
  return reply(200, { setup: res.rows[0] });
}

// Finds a setup the user owns; returns null if it doesn't exist or isn't theirs.
async function ownedSetup(db, userId, setupId) {
  if (!setupId) return null;
  const { rows } = await db.query(
    `SELECT s.bike_setup_id, s.bike_id FROM bike_setup s JOIN bike b USING (bike_id)
      WHERE s.bike_setup_id = $1 AND b.app_user_id = $2`,
    [setupId, userId]
  );
  return rows[0] || null;
}

async function update(db, userId, body) {
  const s = await ownedSetup(db, userId, asId(body.setupId));
  if (!s) return reply(404, { error: "Setup not found" });
  const res = await db.query(
    `UPDATE bike_setup s SET ${COPY_FROM_BIKE}, updated_at = now()
       FROM bike b WHERE b.bike_id = s.bike_id AND s.bike_setup_id = $1
     RETURNING ${SETUP_COLUMNS.split(", ").map((c) => "s." + c).join(", ")}`,
    [s.bike_setup_id]
  );
  await db.query("UPDATE bike SET active_setup_id = $1 WHERE bike_id = $2", [s.bike_setup_id, s.bike_id]);
  return reply(200, { setup: res.rows[0] });
}

async function apply(db, userId, body) {
  const s = await ownedSetup(db, userId, asId(body.setupId));
  if (!s) return reply(404, { error: "Setup not found" });
  await db.query(
    `UPDATE bike b SET ${COPY_FROM_SETUP}, active_setup_id = s.bike_setup_id
       FROM bike_setup s WHERE s.bike_setup_id = $1 AND b.bike_id = s.bike_id`,
    [s.bike_setup_id]
  );
  console.log("user", userId, "applied setup", s.bike_setup_id, "to bike", s.bike_id);
  return reply(200, { bikeId: s.bike_id, setupId: s.bike_setup_id });
}

async function rename(db, userId, body) {
  const s = await ownedSetup(db, userId, asId(body.setupId));
  if (!s) return reply(404, { error: "Setup not found" });
  const name = cleanName(body.name);
  if (!name || name.length > MAX_NAME) return reply(400, { error: `Name must be 1 to ${MAX_NAME} characters`, code: "BAD_NAME" });
  const res = await db.query(
    `UPDATE bike_setup SET name = $2, updated_at = now() WHERE bike_setup_id = $1 RETURNING ${SETUP_COLUMNS}`,
    [s.bike_setup_id, name]
  );
  return reply(200, { setup: res.rows[0] });
}

async function remove(db, userId, body) {
  const s = await ownedSetup(db, userId, asId(body.setupId));
  if (!s) return reply(404, { error: "Setup not found" });
  // active_setup_id on the bike is cleared by ON DELETE SET NULL.
  await db.query("DELETE FROM bike_setup WHERE bike_setup_id = $1", [s.bike_setup_id]);
  return reply(200, { deleted: s.bike_setup_id });
}

const ACTIONS = { list, save, update, apply, rename, delete: remove };

exports.handler = async (event) => {
  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return reply(400, { error: "Bad request" });
  }
  const userId = await userIdFrom(body.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });
  const action = ACTIONS[body.action];
  if (!action) return reply(400, { error: "Unknown action" });

  const db = newClient();
  try {
    await db.connect();
    const { rows } = await db.query("SELECT plan FROM app_user WHERE app_user_id = $1", [userId]);
    if (rows.length === 0) return reply(401, { error: "Please sign in again" });
    if (!billingEnabledFor(userId) || rows[0].plan !== "pro") {
      return reply(403, { error: "Saved setups are a Pro feature", code: "PRO_REQUIRED" });
    }
    await db.query("BEGIN");
    const result = await action(db, userId, body);
    await db.query(result.statusCode === 200 ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    if (err.code === "23505") return reply(409, { error: "This bike already has a setup with that name", code: "NAME_TAKEN" });
    console.error(err);
    return reply(500, { error: "bikeSetups failed" });
  } finally {
    await db.end().catch(() => {});
  }
};
