import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { app } from "../src/index.js";
import { createLink, revokeLink } from "../src/db/client_links.js";
import { makeUploadUrlHandler, allowedMimeTypes, storageConfig, MAX_SESSIONS_PER_LINK_PER_HOUR } from "../src/api/uploads.js";

// node:sqlite needs Node 22.5+. CI also runs Node 20, where this suite is skipped.
let DatabaseSync;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* Node 20 */ }
const SKIP = DatabaseSync ? false : "node:sqlite requires Node 22.5+";

const STORAGE_ENV = { DOCUMENT_BUCKET: {}, R2_BUCKET_NAME: "test-bucket", CF_ACCOUNT_ID: "acct", R2_AK_id: "ak", R2_SAK: "sak" };

function fixture() {
  const raw = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(dir + file, "utf8"));
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1','one','x'),('u2','two','x');
    INSERT INTO firms (id,name) VALUES ('f1','Firm One'),('f2','Firm Two');
    INSERT INTO firm_members (firm_id,user_id) VALUES ('f1','u1'),('f2','u2');
    INSERT INTO contacts (id,user_id,firm_id,name,phone_number) VALUES ('c1','u1','f1','Client One','919999999999'),('c2','u2','f2','Other','918888888888');
    INSERT INTO requests (id,user_id,firm_id,contact_id,title) VALUES ('r1','u1','f1','c1','GST'),('r1b','u1','f1','c1','Second'),('r2','u2','f2','c2','Other');
    INSERT INTO request_items (id,request_id,firm_id,title,max_bytes) VALUES
      ('i1','r1','f1','PAN',1000),('i-acc','r1','f1','Accepted',1000),('i-waived','r1','f1','Waived',1000),
      ('i-pdf','r1','f1','PDF only',1000),('i-other','r1b','f1','Other request item',1000),('i2','r2','f2','Firm two item',1000);
    UPDATE request_items SET status='accepted' WHERE id='i-acc';
    UPDATE request_items SET status='waived' WHERE id='i-waived';
    UPDATE request_items SET allowed_types='pdf' WHERE id='i-pdf';`);
  const db = {
    async execute(q) {
      const sql = typeof q === "string" ? q : q.sql;
      const args = typeof q === "string" ? [] : q.args || [];
      const stmt = raw.prepare(sql);
      if (/^\s*(SELECT|WITH)/i.test(sql)) return { rows: stmt.all(...args).map((r) => ({ ...r })) };
      return { rows: [], changes: Number(stmt.run(...args).changes) };
    },
    async batch(queries) { const out = []; for (const q of queries) out.push(await this.execute(q)); return out; },
  };
  const presigned = [];
  const handler = makeUploadUrlHandler({
    presign: async (_env, args) => { presigned.push(args); return { uploadUrl: `https://r2.example.test/${args.key}?sig=x`, headers: { "Content-Type": args.contentType, "Content-Length": String(args.size) } }; },
  });
  const mini = new Hono();
  mini.post("/api/upload-url/:token", handler);
  const env = { DB: db, ...STORAGE_ENV };
  async function link(requestId = "r1", opts = {}) {
    const made = await createLink(db, { firmId: "f1", requestId, createdBy: "u1", ...opts });
    assert.ok(made.ok);
    return made;
  }
  async function post(token, body, { useApp = false, e = env } = {}) {
    const target = useApp ? app : mini;
    const res = await target.request(`https://collectr.example.test/api/upload-url/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }, e);
    return { status: res.status, headers: res.headers, body: await res.json() };
  }
  const counts = () => ({
    sessions: raw.prepare("SELECT count(*) n FROM upload_sessions").get().n,
    documents: raw.prepare("SELECT count(*) n FROM documents").get().n,
    items: JSON.stringify(raw.prepare("SELECT id,status FROM request_items ORDER BY id").all()),
  });
  return { raw, db, env, link, post, counts, presigned };
}

const good = { itemId: "i1", filename: "pan.pdf", contentType: "application/pdf", size: 500 };

test("upload-url initiator: success and idempotency", { skip: SKIP }, async (t) => {
  await t.test("creates exactly one initiated session, no document, no item status change", async () => {
    const f = fixture();
    const { token, link } = await f.link();
    const before = f.counts();
    const res = await f.post(token, { ...good, idempotencyKey: "k1" });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.deepEqual(Object.keys(res.body).sort(), ["expiresAt", "headers", "uploadSessionId", "uploadUrl"]);
    assert.deepEqual(res.body.headers, { "Content-Type": "application/pdf", "Content-Length": "500" });
    const rows = f.raw.prepare("SELECT * FROM upload_sessions").all();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, res.body.uploadSessionId);
    assert.equal(rows[0].state, "initiated");
    assert.equal(rows[0].link_id, link.id);
    assert.equal(rows[0].declared_size, 500);
    assert.equal(rows[0].object_key, `firms/f1/requests/r1/${rows[0].id}`);
    const ttl = Date.parse(rows[0].expires_at) - Date.now();
    assert.ok(ttl > 14 * 60 * 1000 && ttl <= 15 * 60 * 1000);
    assert.equal(f.presigned.length, 1);
    assert.equal(f.presigned[0].bucketName, "test-bucket");
    const after = f.counts();
    assert.equal(after.documents, 0);
    assert.equal(after.items, before.items);
  });

  await t.test("same idempotencyKey returns the same session; different key creates another", async () => {
    const f = fixture();
    const { token } = await f.link();
    const a = await f.post(token, { ...good, idempotencyKey: "k1" });
    const b = await f.post(token, { ...good, idempotencyKey: "k1" });
    assert.equal(b.status, 200);
    assert.equal(b.body.uploadSessionId, a.body.uploadSessionId);
    assert.equal(f.counts().sessions, 1);
    const c = await f.post(token, { ...good, idempotencyKey: "k2" });
    assert.notEqual(c.body.uploadSessionId, a.body.uploadSessionId);
    assert.equal(f.counts().sessions, 2);
  });

  await t.test("same key with a different file is a conflict and creates nothing new", async () => {
    const f = fixture();
    const { token } = await f.link();
    await f.post(token, { ...good, idempotencyKey: "k1" });
    const res = await f.post(token, { ...good, size: 501, idempotencyKey: "k1" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "idempotency_conflict");
    assert.equal(f.counts().sessions, 1);
  });

  await t.test("expired session on retry is ended, not re-presigned", async () => {
    const f = fixture();
    const { token } = await f.link();
    const a = await f.post(token, { ...good, idempotencyKey: "k1" });
    f.raw.prepare("UPDATE upload_sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    const res = await f.post(token, { ...good, idempotencyKey: "k1" });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "session_expired");
    assert.equal(f.raw.prepare("SELECT state FROM upload_sessions WHERE id = ?").get(a.body.uploadSessionId).state, "expired");
    assert.equal(f.presigned.length, 1);
  });

  await t.test("jpg and png tokens map to image MIME types", () => {
    assert.deepEqual([...allowedMimeTypes("pdf,jpg,png")].sort(), ["application/pdf", "image/jpeg", "image/png"]);
    assert.deepEqual([...allowedMimeTypes("pdf")], ["application/pdf"]);
    assert.deepEqual([...allowedMimeTypes("exe,")], []);
  });
});

test("upload-url initiator: rejections create no upload_sessions row", { skip: SKIP }, async (t) => {
  const cases = [
    ["unknown item id", { ...good, itemId: "nope" }, 404, "item_not_found"],
    ["item of another request", { ...good, itemId: "i-other" }, 404, "item_not_found"],
    ["item of another firm", { ...good, itemId: "i2" }, 404, "item_not_found"],
    ["accepted item", { ...good, itemId: "i-acc" }, 409, "item_closed"],
    ["waived item", { ...good, itemId: "i-waived" }, 409, "item_closed"],
    ["disallowed type for the item", { ...good, itemId: "i-pdf", contentType: "image/png" }, 415, "type_not_allowed"],
    ["type outside the global list", { ...good, contentType: "application/zip" }, 415, "type_not_allowed"],
    ["oversize file", { ...good, size: 1001 }, 413, "file_too_large"],
    ["zero size", { ...good, size: 0 }, 400, "invalid_size"],
    ["fractional size", { ...good, size: 1.5 }, 400, "invalid_size"],
    ["string size", { ...good, size: "10" }, 400, "invalid_size"],
    ["missing filename", { ...good, filename: "" }, 400, "invalid_request"],
    ["missing itemId", { ...good, itemId: undefined }, 400, "invalid_request"],
  ];
  for (const [name, body, status, code] of cases) {
    await t.test(name, async () => {
      const f = fixture();
      const { token } = await f.link();
      const res = await f.post(token, body);
      assert.equal(res.status, status);
      assert.equal(res.body.error, code);
      assert.equal(f.counts().sessions, 0);
      assert.equal(f.presigned.length, 0);
    });
  }

  await t.test("malformed JSON body", async () => {
    const f = fixture();
    const { token } = await f.link();
    const res = await f.post(token, "{not json");
    assert.equal(res.status, 400);
    assert.equal(f.counts().sessions, 0);
  });

  await t.test("unknown, revoked, expired links and closed requests", async () => {
    const f = fixture();
    assert.equal((await f.post("unknown-token", good)).status, 404);
    const revoked = await f.link();
    await revokeLink(f.db, { firmId: "f1", linkId: revoked.link.id });
    const r = await f.post(revoked.token, good);
    assert.equal(r.status, 410); assert.equal(r.body.error, "revoked");
    const expired = await f.link("r1", { expiresAt: "2000-01-01T00:00:00.000Z" });
    const e = await f.post(expired.token, good);
    assert.equal(e.status, 410); assert.equal(e.body.error, "expired");
    const live = await f.link();
    f.raw.prepare("UPDATE requests SET status = 'closed' WHERE id = 'r1'").run();
    const closed = await f.post(live.token, good);
    assert.equal(closed.status, 409); assert.equal(closed.body.error, "request_closed");
    assert.equal(f.counts().sessions, 0);
  });

  await t.test("missing storage configuration returns 503 and creates nothing", async () => {
    for (const missing of ["DOCUMENT_BUCKET", "R2_BUCKET_NAME", "CF_ACCOUNT_ID", "R2_AK_id", "R2_SAK"]) {
      const f = fixture();
      const { token } = await f.link();
      const env = { ...f.env }; delete env[missing];
      const res = await f.post(token, good, { e: env });
      assert.equal(res.status, 503, missing);
      assert.equal(res.body.error, "storage_not_configured");
      assert.equal(f.counts().sessions, 0);
    }
    assert.equal(storageConfig({}), null);
  });

  await t.test("production app route also returns 503 without storage and leaves the item missing", async () => {
    const f = fixture();
    const { token } = await f.link();
    const res = await f.post(token, good, { useApp: true, e: { DB: f.db } });
    assert.equal(res.status, 503);
    assert.equal(f.counts().sessions, 0);
    assert.equal(f.raw.prepare("SELECT status FROM request_items WHERE id='i1'").get().status, "missing");
  });
});

test("upload-url initiator: rate limit and presign failure", { skip: SKIP }, async (t) => {
  await t.test("21st new session in an hour is rejected; retry of an existing key still works", async () => {
    const f = fixture();
    const { token } = await f.link();
    for (let n = 0; n < MAX_SESSIONS_PER_LINK_PER_HOUR; n++) {
      assert.equal((await f.post(token, { ...good, idempotencyKey: `k${n}` })).status, 200);
    }
    const over = await f.post(token, { ...good, idempotencyKey: "k-over" });
    assert.equal(over.status, 429);
    assert.equal(f.counts().sessions, MAX_SESSIONS_PER_LINK_PER_HOUR);
    assert.equal((await f.post(token, { ...good, idempotencyKey: "k0" })).status, 200);
    // another link is unaffected
    const other = await f.link("r1b");
    assert.equal((await f.post(other.token, { ...good, itemId: "i-other", idempotencyKey: "z" })).status, 200);
  });

  await t.test("sessions older than an hour do not count", async () => {
    const f = fixture();
    const { token } = await f.link();
    for (let n = 0; n < MAX_SESSIONS_PER_LINK_PER_HOUR; n++) await f.post(token, { ...good, idempotencyKey: `k${n}` });
    f.raw.prepare("UPDATE upload_sessions SET created_at = datetime('now', '-2 hours')").run();
    assert.equal((await f.post(token, { ...good, idempotencyKey: "fresh" })).status, 200);
  });

  await t.test("presign failure marks the session failed and leaks no detail", async () => {
    const f = fixture();
    const { token } = await f.link();
    const mini = new Hono();
    mini.post("/api/upload-url/:token", makeUploadUrlHandler({ presign: async () => { throw new Error("secret-key-material"); } }));
    const res = await mini.request(`https://x.test/api/upload-url/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(good) }, f.env);
    assert.equal(res.status, 500);
    const text = JSON.stringify(await res.json());
    assert.ok(!text.includes("secret"));
    assert.equal(f.raw.prepare("SELECT state FROM upload_sessions").get().state, "failed");
  });
});
