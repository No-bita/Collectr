import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sign } from "hono/jwt";
import { app } from "../src/index.js";

let DatabaseSync;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* Node 20 */ }
const SKIP = DatabaseSync ? false : "node:sqlite requires Node 22.5+";
const SECRET = "test-only-firm-links-secret";

/**
 * Create an isolated, migrated SQLite database with two firms and route helpers.
 * @returns {object} Database handles and helpers; callers must close `raw` after use.
 */
function fixture() {
  const raw = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(dir + file, "utf8"));
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1','one','x'),('u2','two','x'),('u3','none','x');
    INSERT INTO firms (id,name) VALUES ('f1','Firm One'),('f2','Firm Two');
    INSERT INTO firm_members (firm_id,user_id) VALUES ('f1','u1'),('f2','u2');
    INSERT INTO contacts (id,user_id,firm_id,name,phone_number,email,notes) VALUES
      ('c1','u1','f1','Client One','919999999999','private@example.test','private notes'),
      ('c2','u2','f2','Other Client','918888888888','other@example.test','other notes');
    INSERT INTO requests (id,user_id,firm_id,contact_id,title) VALUES ('other','u2','f2','c2','Private request');
    INSERT INTO request_items (id,request_id,firm_id,title) VALUES ('other-item','other','f2','Private item');`);
  const db = {
    async execute(q) {
      const sql = typeof q === "string" ? q : q.sql;
      const args = typeof q === "string" ? [] : q.args || [];
      const stmt = raw.prepare(sql);
      if (/^\s*(SELECT|WITH)/i.test(sql)) return { rows: stmt.all(...args).map((r) => ({ ...r })) };
      return { rows: [], changes: Number(stmt.run(...args).changes) };
    },
    async batch(queries) {
      raw.exec("BEGIN");
      try { const out = []; for (const q of queries) out.push(await this.execute(q)); raw.exec("COMMIT"); return out; }
      catch (err) { raw.exec("ROLLBACK"); throw err; }
    },
  };
  const env = { DB: db, JWT_SECRET: SECRET, ENVIRONMENT: "production" };
  /**
   * Send an in-process app request using this fixture's database and optional JWT.
   * @param {string} path - Application route path.
   * @param {object} [options={}] - Request options.
   * @param {string} [options.method="GET"] - HTTP method.
   * @param {string|null} [options.user="u1"] - JWT user ID; null omits generated authentication.
   * @param {*} [options.body] - JSON-serialized value, or a string sent verbatim.
   * @param {BodyInit} [options.rawBody] - Unserialized body; takes precedence over `body`.
   * @param {string} [options.duplex] - Fetch duplex mode for streaming raw bodies.
   * @param {object} [options.headers={}] - Additional request headers.
   * @returns {Promise<object>} Response status, headers, and parsed JSON body.
   */
  async function call(path, { method = "GET", user = "u1", body, rawBody, duplex, headers = {} } = {}) {
    if (user) headers = { ...headers, Authorization: `Bearer ${await sign({ id: user, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)}` };
    const res = await app.request(`https://collectr.example.test${path}`, {
      method, headers: { "Content-Type": "application/json", ...headers },
      ...(rawBody !== undefined ? { body: rawBody, ...(duplex ? { duplex } : {}) }
        : body !== undefined ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
    }, env);
    return { status: res.status, headers: res.headers, body: await res.json() };
  }
  async function request() {
    const res = await call("/api/contacts/c1/requests", { method: "POST", body: { title: "GST return", serviceType: "GST", items: [{ title: "PAN", description: "Upload PAN" }, { title: "Optional", required: false }] } });
    assert.equal(res.status, 201);
    return res.body.request.id;
  }
  return { raw, db, call, request };
}

function privateHeaders(res) {
  assert.equal(res.headers.get("Cache-Control"), "no-store");
  assert.equal(res.headers.get("Referrer-Policy"), "no-referrer");
}

const STAFF_PATH = (id) => `/api/requests/${id}/links`;
const SESSION = (token) => `/api/session/${token}`;

test("link routes: fresh database create + public exact projection, no network lock", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const created = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    assert.equal(created.status, 201); privateHeaders(created);
    assert.equal(new URL(created.body.url).pathname, "/upload.html");
    assert.equal(new URL(created.body.url).searchParams.get("t"), created.body.token);
    const session = await f.call(SESSION(created.body.token), { user: null, headers: { "CF-Connecting-IP": "1.1.1.1", "User-Agent": "first" } });
    assert.equal(session.status, 200); privateHeaders(session);
    assert.deepEqual(Object.keys(session.body).sort(), ["client_name", "due_date", "firm_name", "items", "service_type"]);
    assert.equal(session.body.firm_name, "Firm One"); assert.equal(session.body.client_name, "Client One");
    assert.equal(session.body.service_type, "GST"); assert.equal(session.body.items.length, 2);
    for (const item of session.body.items) {
      assert.deepEqual(Object.keys(item).sort(), ["allowed_types", "description", "id", "max_bytes", "required", "status", "title", "upload_count"]);
      assert.equal(item.upload_count, 0); assert.equal(item.status, "missing");
    }
    assert.equal(session.body.items[1].required, false);
    assert.equal(JSON.stringify(session.body).includes("private"), false);
    const changedNetwork = await f.call(SESSION(created.body.token), { user: null, headers: { "CF-Connecting-IP": "2.2.2.2", "User-Agent": "mobile" } });
    assert.deepEqual(changedNetwork.body, session.body);
    const list = await f.call(STAFF_PATH(id));
    assert.equal(list.status, 200); privateHeaders(list);
    assert.deepEqual(Object.keys(list.body.links[0]).sort(), ["created_at", "expires_at", "id", "last_used_at", "revoked_at", "status"]);
    assert.equal(JSON.stringify(list.body).includes(created.body.token), false);
    assert.equal(list.body.links[0].status, "active");
  } finally { f.raw.close(); }
});

test("link routes: revoke, regenerate, expired, unknown and closed stable failures", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const a = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    const b = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    const regenerated = await f.call(`${STAFF_PATH(id)}/regenerate`, { method: "POST", body: {} });
    assert.equal(regenerated.status, 201); assert.equal(regenerated.body.revokedCount, 2);
    for (const old of [a, b]) { const r = await f.call(SESSION(old.body.token), { user: null }); assert.equal(r.status, 410); assert.deepEqual(r.body, { error: "revoked" }); privateHeaders(r); }
    const token = regenerated.body.token;
    assert.equal((await f.call(SESSION(token), { user: null })).status, 200);
    f.raw.prepare("UPDATE requests SET status='closed' WHERE id=?").run(id);
    let res = await f.call(SESSION(token), { user: null }); assert.equal(res.status, 409); assert.deepEqual(res.body, { error: "request_closed" }); privateHeaders(res);
    assert.equal((await f.call(STAFF_PATH(id))).body.links.find((l) => l.id === regenerated.body.link.id).status, "request_closed");
    for (const suffix of ["", "/regenerate"]) {
      const denied = await f.call(`${STAFF_PATH(id)}${suffix}`, { method: "POST", body: {} });
      assert.equal(denied.status, 409); assert.deepEqual(denied.body, { error: "request_closed" });
    }
    f.raw.prepare("UPDATE requests SET status='open' WHERE id=?").run(id);
    f.raw.prepare("UPDATE client_links SET expires_at='2000-01-01T00:00:00Z' WHERE id=?").run(regenerated.body.link.id);
    res = await f.call(SESSION(token), { user: null }); assert.equal(res.status, 410); assert.deepEqual(res.body, { error: "expired" }); privateHeaders(res);
    const fresh = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    for (let i = 0; i < 2; i++) assert.equal((await f.call(`${STAFF_PATH(id)}/${fresh.body.link.id}/revoke`, { method: "POST" })).status, 200);
    res = await f.call(SESSION(fresh.body.token), { user: null }); assert.equal(res.status, 410); assert.equal(res.body.error, "revoked");
    res = await f.call(SESSION("unknown"), { user: null }); assert.equal(res.status, 404); assert.deepEqual(res.body, { error: "not_found" }); privateHeaders(res);
  } finally { f.raw.close(); }
});

test("link routes: authentication, firm and request boundaries on every staff endpoint", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const link = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    for (const [path, method] of [[STAFF_PATH(id), "GET"], [STAFF_PATH(id), "POST"], [`${STAFF_PATH(id)}/regenerate`, "POST"], [`${STAFF_PATH(id)}/${link.body.link.id}/revoke`, "POST"]]) {
      for (const [user, status] of [[null, 401], ["u2", 404], ["u3", 403]]) assert.equal((await f.call(path, { method, user, ...(method === "POST" ? { body: {} } : {}) })).status, status);
    }
    f.raw.prepare("INSERT INTO requests (id,user_id,firm_id,contact_id,title) VALUES ('same-firm','u1','f1','c1','Other')").run();
    assert.equal((await f.call(`${STAFF_PATH("same-firm")}/${link.body.link.id}/revoke`, { method: "POST" })).status, 404);
    assert.equal((await f.call(SESSION(link.body.token), { user: null })).status, 200);
  } finally { f.raw.close(); }
});

test("link routes: due date + 7 days, default 14 days and explicit expiry validation", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const start = Date.now();
    let res = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    assert.ok(Date.parse(res.body.link.expires_at) >= start + 14 * 86400000);
    f.raw.prepare("UPDATE requests SET due_date='2099-03-01' WHERE id=?").run(id);
    res = await f.call(STAFF_PATH(id), { method: "POST", body: {} }); assert.equal(res.body.link.expires_at, "2099-03-08T00:00:00.000Z");
    const noBody = await f.call(STAFF_PATH(id), { method: "POST" }); assert.equal(noBody.status, 201); assert.equal(noBody.body.link.expires_at, "2099-03-08T00:00:00.000Z");
    res = await f.call(STAFF_PATH(id), { method: "POST", body: { expiresAt: "2099-04-01T09:00:00+05:30" } }); assert.equal(res.body.link.expires_at, "2099-04-01T03:30:00.000Z");
    const before = f.raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n;
    for (const body of ["not json", [], null, { expiresAt: "bad" }, { expiresAt: 123 }, { expiresAt: null }, { expiresAt: "2020-01-01T00:00:00Z" }, { expiresAt: "2099-01-01" }]) {
      assert.equal((await f.call(`${STAFF_PATH(id)}/regenerate`, { method: "POST", body })).status, 400);
    }
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n, before);
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM client_links WHERE revoked_at IS NOT NULL").get().n, 0);
    const noBodyRegen = await f.call(`${STAFF_PATH(id)}/regenerate`, { method: "POST" }); assert.equal(noBodyRegen.status, 201);
  } finally { f.raw.close(); }
});

test("session failures do not log or reflect tokens or exception text", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const link = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    const old = f.db.execute;
    f.db.execute = async () => { throw new Error(link.body.token); };
    const saved = console.error; const logs = []; console.error = (...args) => logs.push(args);
    let res;
    try { res = await f.call(SESSION(link.body.token), { user: null }); } finally { console.error = saved; f.db.execute = old; }
    assert.equal(res.status, 500); assert.deepEqual(res.body, { error: "session_unavailable" }); privateHeaders(res); assert.deepEqual(logs, []);
  } finally { f.raw.close(); }
});

test("session upload counts exclude rejected/superseded and scope firm, request and item", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    // Read-only contract fixture for issue #5, no production schema change here.
    f.raw.exec("DROP TABLE IF EXISTS documents; CREATE TABLE documents (id TEXT PRIMARY KEY, firm_id TEXT, request_id TEXT, item_id TEXT, state TEXT)");
    const item = f.raw.prepare("SELECT id FROM request_items WHERE request_id=? ORDER BY position").get(id).id;
    const insert = f.raw.prepare("INSERT INTO documents VALUES (?,?,?,?,?)");
    for (const [doc, firm, req, state] of [["d1", "f1", id, "received"], ["d2", "f1", id, "accepted"], ["d3", "f1", id, "rejected"], ["d4", "f1", id, "superseded"], ["d5", "f2", id, "received"], ["d6", "f1", "other", "received"]]) insert.run(doc, firm, req, item, state);
    const link = await f.call(STAFF_PATH(id), { method: "POST", body: {} });
    const session = await f.call(SESSION(link.body.token), { user: null });
    assert.equal(session.status, 200); assert.equal(session.body.items[0].upload_count, 2); assert.equal(session.body.items[1].upload_count, 0);
    f.raw.exec("DROP TABLE documents; CREATE TABLE documents (wrong_column TEXT)");
    const failed = await f.call(SESSION(link.body.token), { user: null });
    assert.equal(failed.status, 500); assert.deepEqual(failed.body, { error: "session_unavailable" });
  } finally { f.raw.close(); }
});

test("link routes: request body stream read failure returns 500 and creates no link", { skip: SKIP }, async () => {
  const f = fixture();
  try {
    const id = await f.request();
    const errorStream = new ReadableStream({
      /**
       * Fail the stream immediately to exercise request-body read error handling.
       * @param {ReadableStreamDefaultController} controller - Controller to put in the errored state.
       */
      start(controller) {
        controller.error(new Error("Simulated stream read failure"));
      },
    });
    const before = f.raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n;
    const res = await f.call(STAFF_PATH(id), { method: "POST", rawBody: errorStream, duplex: "half" });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { error: "Failed to issue client link." });
    assert.equal(f.raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n, before);
  } finally { f.raw.close(); }
});

