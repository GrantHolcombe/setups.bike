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

// The signed-in user, from the token AddUser issued. Returns null if the token is
// missing, expired or not signed with our secret.
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

// Columns the app may update. Column names are fixed here, never taken from the request.
const COLUMNS = [
  "front_tire", "front_sus_pressure", "front_sus_comp_1", "front_sus_comp_2",
  "front_sus_comp_count", "front_tokens", "rear_tire", "rear_sus_pressure",
  "rear_sus_comp_1", "rear_sus_comp_2", "rear_sus_comp_count",
  "front_sus_rebound_1", "front_sus_rebound_2", "front_sus_rebound_count",
  "rear_sus_rebound_1", "rear_sus_rebound_2", "rear_sus_rebound_count", "rear_tokens"
];

// Missing, empty or anything that isn't a number (an emptied input, "NaN") means "leave this
// column as it is". Real settings are whole numbers and can't be negative, so anything else
// is rounded and floored at 0.
const toValue = (v) => {
  if (v === undefined || v === null || v === "" || v === "NaN" || v === "null") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(99999, Math.max(0, Math.round(n)));
};

exports.handler = async (event) => {
  const data = event.queryStringParameters || {};
  const userId = await userIdFrom(data.token);
  if (userId === null) return reply(401, { error: "Please sign in again" });

  const client = newClient();
  try {
    const sets = COLUMNS.map((c, i) => `${c} = COALESCE($${i + 1}, ${c})`).join(",\n        ");
    const values = COLUMNS.map((c) => toValue(data[c]));
    values.push(data.bike_id, userId);

    await client.connect();
    // Only updates the bike if it belongs to the signed-in user.
    const res = await client.query(
      `UPDATE bike SET
        ${sets}
      WHERE bike_id = $${COLUMNS.length + 1} AND app_user_id = $${COLUMNS.length + 2}`,
      values
    );
    if (res.rowCount === 0) return reply(404, { error: "Bike not found" });
    return reply(200, res.rows);
  } catch (err) {
    console.error(err);
    return reply(500, { error: "updateBike failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
