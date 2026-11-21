// POST /rideNotes   body: {"token": "...", "action": "...", ...}
// Pro feature 2.2: notes on how a bike rode. Each note keeps a snapshot of the bike's
// settings at the time it was logged.
//
// Actions:
//   list    {bikeId}                                     -> that bike's notes, newest ride first
//   add     {bikeId, rideDate, trail, conditions, rating, note}
//                                                        -> snapshot the bike's current settings
//   edit    {noteId, rideDate, trail, conditions, rating, note}   (the snapshot never changes)
//   delete  {noteId}
//   reuse   {noteId}                                     -> copy the note's settings onto its bike
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

// The 18 settings a note stores. Column names are fixed here, never taken from the request.
const FIELDS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "front_tokens", "rear_tire", "rear_sus_pressure", "rear_sus_comp_1", "rear_sus_comp_2",
  "rear_sus_comp_count", "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count",
  "rear_tokens"
];
const CONDITIONS = ["dry", "tacky", "wet", "muddy", "loose", "snow"];
const MAX_NOTES_PER_BIKE = 500;
const MAX_TRAIL = 80;
const MAX_NOTE = 2000;

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

const asId = (v) => (Number.isInteger(Number(v)) && Number(v) > 0 ? Number(v) : null);
const text = (v) => (typeof v === "string" ? v.trim() : "");

// Checks and tidies the fields a user types. Returns {error} or {values}.
function noteFields(body) {
  const rideDate = text(body.rideDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rideDate) || Number.isNaN(Date.parse(rideDate))) {
    return { error: "Pick the date of the ride" };
  }
  // allow a day of slack for time zones, but no rides far in the future
  if (Date.parse(rideDate) > Date.now() + 36 * 3600 * 1000) return { error: "That date is in the future" };
  const trail = text(body.trail).replace(/\s+/g, " ");
  if (trail.length > MAX_TRAIL) return { error: `Keep the trail to ${MAX_TRAIL} characters` };
  const note = text(body.note);
  if (note.length > MAX_NOTE) return { error: `Keep the note to ${MAX_NOTE} characters` };
  const conditions = body.conditions ? text(body.conditions).toLowerCase() : "";
  if (conditions && !CONDITIONS.includes(conditions)) return { error: "Unknown trail conditions" };
  let rating = null;
  if (body.rating !== undefined && body.rating !== null && body.rating !== "") {
    rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Rating must be 1 to 5" };
  }
  if (!trail && !note && !rating && !conditions) return { error: "Add a trail, rating, conditions or a note" };
  return { values: [rideDate, trail || null, conditions || null, rating, note || null] };
}

const NOTE_COLUMNS = "ride_note_id, bike_id, to_char(ride_date, 'YYYY-MM-DD') AS ride_date, trail, conditions, rating, note, setup_name, settings, created_at, updated_at";
const SNAPSHOT = `jsonb_build_object(${FIELDS.map((f) => `'${f}', COALESCE(b.${f}, 0)`).join(", ")})`;

const ownsBike = async (db, userId, bikeId) =>
  bikeId && (await db.query("SELECT 1 FROM bike WHERE bike_id = $1 AND app_user_id = $2", [bikeId, userId])).rowCount > 0;

async function ownedNote(db, userId, noteId) {
  if (!noteId) return null;
  const { rows } = await db.query(
    `SELECT n.ride_note_id, n.bike_id FROM ride_note n JOIN bike b USING (bike_id)
      WHERE n.ride_note_id = $1 AND b.app_user_id = $2`,
    [noteId, userId]
  );
  return rows[0] || null;
}

async function list(db, userId, body) {
  const bikeId = asId(body.bikeId);
  if (!(await ownsBike(db, userId, bikeId))) return reply(404, { error: "Bike not found" });
  const { rows } = await db.query(
    `SELECT ${NOTE_COLUMNS} FROM ride_note WHERE bike_id = $1 ORDER BY ride_date DESC, ride_note_id DESC`,
    [bikeId]
  );
  return reply(200, { notes: rows });
}

async function add(db, userId, body) {
  const bikeId = asId(body.bikeId);
  if (!(await ownsBike(db, userId, bikeId))) return reply(404, { error: "Bike not found" });
  const f = noteFields(body);
  if (f.error) return reply(400, { error: f.error, code: "BAD_NOTE" });
  const count = await db.query("SELECT count(*)::int AS n FROM ride_note WHERE bike_id = $1", [bikeId]);
  if (count.rows[0].n >= MAX_NOTES_PER_BIKE) {
    return reply(409, { error: `A bike can have up to ${MAX_NOTES_PER_BIKE} ride notes`, code: "TOO_MANY" });
  }
  // setup_name: the saved setup the bike was on, if its settings still matched it
  const matches = FIELDS.map((x) => `s.${x} = COALESCE(b.${x}, 0)`).join(" AND ");
  const { rows } = await db.query(
    `INSERT INTO ride_note (bike_id, ride_date, trail, conditions, rating, note, setup_name, settings)
     SELECT b.bike_id, $3, $4, $5, $6, $7,
            (SELECT s.name FROM bike_setup s WHERE s.bike_setup_id = b.active_setup_id AND ${matches}),
            ${SNAPSHOT}
       FROM bike b WHERE b.bike_id = $1 AND b.app_user_id = $2
     RETURNING ${NOTE_COLUMNS}`,
    [bikeId, userId, ...f.values]
  );
  return reply(200, { note: rows[0] });
}

async function edit(db, userId, body) {
  const n = await ownedNote(db, userId, asId(body.noteId));
  if (!n) return reply(404, { error: "Ride note not found" });
  const f = noteFields(body);
  if (f.error) return reply(400, { error: f.error, code: "BAD_NOTE" });
  const { rows } = await db.query(
    `UPDATE ride_note SET ride_date = $2, trail = $3, conditions = $4, rating = $5, note = $6, updated_at = now()
      WHERE ride_note_id = $1 RETURNING ${NOTE_COLUMNS}`,
    [n.ride_note_id, ...f.values]
  );
  return reply(200, { note: rows[0] });
}

async function remove(db, userId, body) {
  const n = await ownedNote(db, userId, asId(body.noteId));
  if (!n) return reply(404, { error: "Ride note not found" });
  await db.query("DELETE FROM ride_note WHERE ride_note_id = $1", [n.ride_note_id]);
  return reply(200, { deleted: n.ride_note_id });
}

// Puts the note's settings back on its bike. active_setup_id is left alone, so the setup
// picker shows "(edited)" if these settings differ from the saved setup.
async function reuse(db, userId, body) {
  const n = await ownedNote(db, userId, asId(body.noteId));
  if (!n) return reply(404, { error: "Ride note not found" });
  const sets = FIELDS.map((f) => `${f} = COALESCE((n.settings->>'${f}')::int, 0)`).join(", ");
  await db.query(
    `UPDATE bike b SET ${sets} FROM ride_note n WHERE n.ride_note_id = $1 AND b.bike_id = n.bike_id`,
    [n.ride_note_id]
  );
  console.log("user", userId, "reused ride note", n.ride_note_id, "on bike", n.bike_id);
  return reply(200, { bikeId: n.bike_id });
}

const ACTIONS = { list, add, edit, delete: remove, reuse };

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
      return reply(403, { error: "Ride notes are a Pro feature", code: "PRO_REQUIRED" });
    }
    await db.query("BEGIN");
    const result = await action(db, userId, body);
    await db.query(result.statusCode === 200 ? "COMMIT" : "ROLLBACK");
    return result;
  } catch (err) {
    await db.query("ROLLBACK").catch(() => {});
    console.error(err);
    return reply(500, { error: "rideNotes failed" });
  } finally {
    await db.end().catch(() => {});
  }
};
