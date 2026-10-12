import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { app } from "../src/index.js";
import { createLink, revokeLink } from "../src/db/client_links.js";
import { createUploadSession } from "../src/db/upload_sessions.js";

// node:sqlite needs Node 22.5+. CI also runs Node 20, where this suite is skipped.
let DatabaseSync;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* Node 20 */ }
const SKIP = DatabaseSync ? false : "node:sqlite requires Node 22.5+";

function fixture() {
  const raw = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(dir + file, "utf8"));
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1','one','x'),('u2','two','x');
    INSERT INTO firms (id,name) VALUES ('f1','Firm One'),('f2','Firm Two');
    INSERT INTO firm_members (firm_id,user_id) VALUES ('f1','u1'),('f2','u2');
    INSERT INTO contacts (id,user_id,firm_id,name,phone_number) VALUES ('c1','u1','f1','Client One','919999999999'),('c2','u2','f2','Other','918888888888');
    INSERT INTO requests (id,user_id,firm_id,contact_id,title) VALUES ('r1','u1','f1','c1','GST'),('r1b','u1','f1','c1','Second');
    INSERT INTO request_items (id,request_id,firm_id,title,max_bytes) VALUES
      ('i1','r1','f1','PAN',1000),('i-acc','r1','f1','Accepted',1000),('i-other','r1b','f1','Other request item',1000);
    UPDATE request_items SET status='accepted' WHERE id='i-acc';`);
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
  const objects = new Map();
  const deleted = [];
  const bucket = {
    async head(key) { return objects.get(key) ?? null; },
    async delete(key) { deleted.push(key); objects.delete(key); },
  };
  const env = { DB: db, DOCUMENT_BUCKET: bucket };
  let n = 0;
  async function start({ requestId = "r1", itemId = "i1", linkRow, size = 500, type = "application/pdf" } = {}) {
    const l = linkRow ?? await createLink(db, { firmId: "f1", requestId, createdBy: "u1" });
    const created = await createUploadSession(db, {
      firmId: "f1", requestId, itemId, linkId: l.link.id, declaredContentType: type, declaredSize: size,
      originalFilename: "pan.pdf", expiresAt: new Date(Date.now() + 600000).toISOString(), idempotencyKey: `k${++n}`,
    });
    assert.ok(created.ok);
    return { token: l.token, link: l, session: created.session };
  }
  function put(session, { size = session.declared_size, type = session.declared_content_type, etag = "etag-1" } = {}) {
    objects.set(session.object_key, { size, etag, httpMetadata: { contentType: type } });
  }
  async function complete(token, body, e = env) {
    const res = await app.request(`https://collectr.example.test/api/upload-complete/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }, e);
    return { status: res.status, headers: res.headers, body: await res.json() };
  }
  const q = (sql, ...a) => raw.prepare(sql).all(...a);
  return { raw, db, env, objects, deleted, start, put, complete, q };
}

test("upload-complete: verified receipt", { skip: SKIP }, async (t) => {
  await t.test("stored object: one document, item received, one document_received event", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    const res = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.equal(res.body.itemId, "i1");
    assert.equal(res.body.itemStatus, "received");
    assert.equal(res.body.uploadCount, 1);
    assert.ok(!JSON.stringify(res.body).toLowerCase().includes("verified"));
    const docs = f.q("SELECT * FROM documents");
    assert.equal(docs.length, 1);
    assert.equal(docs[0].id, res.body.documentId);
    assert.equal(docs[0].version, 1);
    assert.equal(docs[0].state, "received");
    assert.equal(docs[0].etag, "etag-1");
    assert.equal(docs[0].size_bytes, 500);
    assert.equal(docs[0].object_key, session.object_key);
    const s = f.q("SELECT state, completed_at FROM upload_sessions WHERE id = ?", session.id)[0];
    assert.equal(s.state, "completed");
    assert.ok(s.completed_at);
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "received");
    assert.equal(f.q("SELECT * FROM activities WHERE activity_type='document_received'").length, 1);
    assert.equal(f.q("SELECT * FROM activities WHERE activity_type='item_transition'").length, 1);
  });

  await t.test("double confirm: same documentId, no second document or event", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    const a = await f.complete(token, { uploadSessionId: session.id });
    const b = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(b.status, 200);
    assert.equal(b.body.documentId, a.body.documentId);
    assert.equal(f.q("SELECT * FROM documents").length, 1);
    assert.equal(f.q("SELECT * FROM activities WHERE activity_type='document_received'").length, 1);
    assert.equal(f.q("SELECT * FROM activities WHERE activity_type='item_transition'").length, 1);
  });

  await t.test("retry after a crash between document and item update still moves the item", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    await f.complete(token, { uploadSessionId: session.id });
    f.raw.prepare("UPDATE request_items SET status='missing' WHERE id='i1'").run();
    const res = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(res.status, 200);
    assert.equal(res.body.itemStatus, "received");
    assert.equal(f.q("SELECT * FROM documents").length, 1);
  });

  await t.test("second upload gets version 2, supersedes a rejected file, keeps an in-review item in review", async () => {
    const f = fixture();
    const first = await f.start();
    f.put(first.session);
    const a = await f.complete(first.token, { uploadSessionId: first.session.id });
    f.raw.prepare("UPDATE documents SET state='rejected' WHERE id=?").run(a.body.documentId);
    f.raw.prepare("UPDATE request_items SET status='needs_replacement' WHERE id='i1'").run();
    const second = await f.start({ linkRow: first.link });
    f.put(second.session, { etag: "etag-2" });
    const b = await f.complete(second.token, { uploadSessionId: second.session.id });
    assert.equal(b.status, 200);
    assert.equal(b.body.itemStatus, "received");
    assert.equal(b.body.uploadCount, 1);
    const docs = f.q("SELECT id, version, state FROM documents ORDER BY version");
    assert.deepEqual(docs.map((d) => [d.version, d.state]), [[1, "superseded"], [2, "received"]]);
    // A further upload while the item is already received/under_review leaves the status alone.
    f.raw.prepare("UPDATE request_items SET status='under_review' WHERE id='i1'").run();
    const third = await f.start({ linkRow: first.link });
    f.put(third.session, { etag: "etag-3" });
    const c = await f.complete(third.token, { uploadSessionId: third.session.id });
    assert.equal(c.status, 200);
    assert.equal(c.body.itemStatus, "under_review");
    assert.equal(f.q("SELECT version FROM documents ORDER BY version").length, 3);
  });
});

test("upload-complete: rejections create no document", { skip: SKIP }, async (t) => {
  await t.test("object missing: 409, session stays initiated, item untouched, retry works after the PUT", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    const res = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "object_missing");
    assert.equal(f.q("SELECT * FROM documents").length, 0);
    assert.equal(f.q("SELECT state FROM upload_sessions")[0].state, "initiated");
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "missing");
    f.put(session);
    assert.equal((await f.complete(token, { uploadSessionId: session.id })).status, 200);
  });

  for (const [name, opts] of [["size", { size: 501 }], ["type", { type: "image/png" }]]) {
    await t.test(`${name} mismatch: 422, object deleted, session failed`, async () => {
      const f = fixture();
      const { token, session } = await f.start();
      f.put(session, opts);
      const res = await f.complete(token, { uploadSessionId: session.id });
      assert.equal(res.status, 422);
      assert.equal(res.body.error, "object_mismatch");
      assert.deepEqual(f.deleted, [session.object_key]);
      assert.equal(f.q("SELECT * FROM documents").length, 0);
      assert.equal(f.q("SELECT state FROM upload_sessions")[0].state, "failed");
      assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "missing");
      assert.equal((await f.complete(token, { uploadSessionId: session.id })).status, 409);
    });
  }

  await t.test("session from another request or link is not found", async () => {
    const f = fixture();
    const a = await f.start();
    const other = await f.start({ requestId: "r1b", itemId: "i-other" });
    f.put(other.session);
    const res = await f.complete(a.token, { uploadSessionId: other.session.id });
    assert.equal(res.status, 404);
    assert.equal(res.body.error, "session_not_found");
    // Same request, different link.
    const second = await createLink(f.db, { firmId: "f1", requestId: "r1", createdBy: "u1" });
    f.put(a.session);
    assert.equal((await f.complete(second.token, { uploadSessionId: a.session.id })).status, 404);
    assert.equal(f.q("SELECT * FROM documents").length, 0);
  });

  await t.test("revoked, expired, unknown links are rejected", async () => {
    const f = fixture();
    const { token, session, link } = await f.start();
    f.put(session);
    assert.equal((await f.complete("nope", { uploadSessionId: session.id })).status, 404);
    f.raw.prepare("UPDATE client_links SET expires_at='2000-01-01T00:00:00.000Z'").run();
    assert.equal((await f.complete(token, { uploadSessionId: session.id })).status, 410);
    f.raw.prepare("UPDATE client_links SET expires_at='2999-01-01T00:00:00.000Z'").run();
    await revokeLink(f.db, { firmId: "f1", linkId: link.link.id });
    assert.equal((await f.complete(token, { uploadSessionId: session.id })).status, 410);
    assert.equal(f.q("SELECT * FROM documents").length, 0);
  });

  await t.test("expired session is ended and rejected", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    f.raw.prepare("UPDATE upload_sessions SET expires_at='2000-01-01T00:00:00.000Z'").run();
    const res = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "session_expired");
    assert.equal(f.q("SELECT state FROM upload_sessions")[0].state, "expired");
  });

  await t.test("item accepted meanwhile is closed", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    f.raw.prepare("UPDATE request_items SET status='accepted' WHERE id='i1'").run();
    const res = await f.complete(token, { uploadSessionId: session.id });
    assert.equal(res.status, 409);
    assert.equal(res.body.error, "item_closed");
    assert.equal(f.q("SELECT * FROM documents").length, 0);
  });

  await t.test("bad bodies, no storage binding, storage errors", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    assert.equal((await f.complete(token, "not json")).status, 400);
    assert.equal((await f.complete(token, [])).status, 400);
    assert.equal((await f.complete(token, {})).status, 400);
    assert.equal((await f.complete(token, { uploadSessionId: 5 })).status, 400);
    assert.equal((await f.complete(token, { uploadSessionId: session.id }, { DB: f.db })).status, 503);
    const broken = { DB: f.db, DOCUMENT_BUCKET: { head: async () => { throw new Error("boom"); } } };
    const res = await f.complete(token, { uploadSessionId: session.id }, broken);
    assert.equal(res.status, 502);
    assert.equal(f.q("SELECT state FROM upload_sessions")[0].state, "initiated");
  });

  await t.test("concurrent confirms produce one document", async () => {
    const f = fixture();
    const { token, session } = await f.start();
    f.put(session);
    const [a, b] = await Promise.all([f.complete(token, { uploadSessionId: session.id }), f.complete(token, { uploadSessionId: session.id })]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(a.body.documentId, b.body.documentId);
    assert.equal(f.q("SELECT * FROM documents").length, 1);
  });
});

test("session endpoint reflects the receipt after reload", { skip: SKIP }, async () => {
  const f = fixture();
  const { token, session } = await f.start();
  f.put(session);
  await f.complete(token, { uploadSessionId: session.id });
  const res = await app.request(`https://collectr.example.test/api/session/${token}`, {}, f.env);
  assert.equal(res.status, 200);
  const item = (await res.json()).items.find((i) => i.id === "i1");
  assert.equal(item.status, "received");
  assert.equal(item.upload_count, 1);
});
