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

exports.handler = async (event) => {
  const client = newClient();
  try {
    const body = JSON.parse(event.body || "{}");
    const userId = await userIdFrom(body.token);
    if (userId === null) return reply(401, { error: "Please sign in again" });

    const deleteList = (body.deleteList || []).map(Number);
    if (deleteList.length === 0 || deleteList.some((id) => !Number.isInteger(id))) {
      return reply(400, { error: "deleteList must be bike ids" });
    }
    await client.connect();
    await client.query("BEGIN");
    // Only deletes bikes that belong to the signed-in user. Their garage_order rows go
    // with them (ON DELETE CASCADE).
    const res = await client.query(
      "DELETE FROM bike WHERE bike_id = ANY($1::bigint[]) AND app_user_id = $2",
      [deleteList, userId]
    );
    // Close the gap the deleted bikes left, so the garage stays numbered 1..n.
    await client.query(
      `UPDATE garage_order g SET garage_order = r.pos
         FROM (SELECT garage_order_id,
                      row_number() OVER (ORDER BY garage_order, garage_order_id) AS pos
                 FROM garage_order WHERE app_user_id = $1) r
        WHERE g.garage_order_id = r.garage_order_id AND g.garage_order <> r.pos`,
      [userId]
    );
    await client.query("COMMIT");
    console.log("user", userId, "deleted bikes", deleteList, "rows", res.rowCount);
    return reply(200, res.rows);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(err);
    return reply(500, { error: "deleteBike failed" });
  } finally {
    await client.end().catch(() => {});
  }
};
