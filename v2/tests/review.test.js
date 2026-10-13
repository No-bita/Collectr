import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { sign } from "hono/jwt";
import { app } from "../src/index.js";
import { createLink } from "../src/db/client_links.js";
import { createUploadSession } from "../src/db/upload_sessions.js";
import { reviewItem } from "../src/db/request-state.js";
import { StateConflict } from "../src/domain/states.js";

// node:sqlite needs Node 22.5+. CI also runs Node 20, where this suite is skipped.
let DatabaseSync;
try { ({ DatabaseSync } = await import("node:sqlite")); } catch { /* Node 20 */ }
const SKIP = DatabaseSync ? false : "node:sqlite requires Node 22.5+";
const SECRET = "test-secret";

function fixture() {
  const raw = new DatabaseSync(":memory:");
  const dir = fileURLToPath(new URL("../migrations/", import.meta.url));
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) raw.exec(fs.readFileSync(dir + file, "utf8"));
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1','one','x'),('u2','two','x');
    INSERT INTO firms (id,name) VALUES ('f1','Firm One'),('f2','Firm Two');
    INSERT INTO firm_members (firm_id,user_id) VALUES ('f1','u1'),('f2','u2');
    INSERT INTO contacts (id,user_id,firm_id,name,phone_number) VALUES ('c1','u1','f1','Client One','919999999999'),('c2','u2','f2','Other','918888888888');
    INSERT INTO requests (id,user_id,firm_id,contact_id,title,status) VALUES ('r1','u1','f1','c1','GST','open');
    INSERT INTO request_items (id,request_id,firm_id,title,max_bytes,required) VALUES
      ('i1','r1','f1','PAN',1000,1),('i2','r1','f1','Optional',1000,0);`);
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
  const bucket = {
    async head(key) { return objects.get(key) ?? null; },
    async delete(key) { objects.delete(key); },
    async get(key) { const o = objects.get(key); return o ? { body: o.bytes } : null; },
  };
  const env = { DB: db, DOCUMENT_BUCKET: bucket, JWT_SECRET: SECRET, ENVIRONMENT: "production" };
  let n = 0;
  async function api(method, path, { user = "u1", body } = {}) {
    const headers = { "Content-Type": "application/json" };
    if (user) headers.Authorization = `Bearer ${await sign({ id: user, exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET)}`;
    const res = await app.request(`https://collectr.example.test${path}`, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    }, env);
    return res;
  }
  async function json(method, path, opts) {
    const res = await api(method, path, opts);
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  }
  /** Client uploads and completes one file for an item over the real link routes. */
  async function upload(itemId = "i1", linkInfo) {
    const l = linkInfo ?? await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1" });
    const created = await createUploadSession(db, {
      firmId: "f1", requestId: "r1", itemId, linkId: l.link.id, declaredContentType: "application/pdf", declaredSize: 500,
      originalFilename: 'pan "x".pdf', expiresAt: new Date(Date.now() + 600000).toISOString(), idempotencyKey: `k${++n}`,
    });
    objects.set(created.session.object_key, { size: 500, etag: `e${n}`, httpMetadata: { contentType: "application/pdf" }, bytes: `file-${n}` });
    const res = await app.request(`https://collectr.example.test/api/upload-complete/${l.token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadSessionId: created.session.id }),
    }, env);
    assert.equal(res.status, 200);
    return { link: l, documentId: (await res.json()).documentId };
  }
  const q = (sql, ...a) => raw.prepare(sql).all(...a);
  return { raw, db, env, api, json, upload, q };
}

test("staff review", { skip: SKIP }, async (t) => {
  await t.test("requires authentication", async () => {
    const f = fixture();
    assert.equal((await f.json("GET", "/api/requests/r1", { user: null })).status, 401);
    assert.equal((await f.json("GET", "/api/documents/x/download", { user: null })).status, 401);
  });

  await t.test("GET request shows items, document versions and progress", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    const res = await f.json("GET", "/api/requests/r1");
    assert.equal(res.status, 200);
    assert.equal(res.body.request.id, "r1");
    const pan = res.body.items.find((i) => i.id === "i1");
    assert.equal(pan.status, "received");
    assert.equal(pan.documents.length, 1);
    assert.equal(pan.documents[0].id, documentId);
    assert.equal(pan.documents[0].version, 1);
    assert.equal(res.body.progress.counts.received, 1);
    assert.equal(res.body.progress.canClose, false);
    assert.ok(!("object_key" in pan.documents[0]) && !("objectKey" in pan.documents[0]));
  });

  await t.test("accept: item accepted, document accepted, review event with reviewer and time", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    const res = await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "accepted");
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "accepted");
    assert.equal(f.q("SELECT state FROM documents WHERE id=?", documentId)[0].state, "accepted");
    const ev = f.q("SELECT * FROM review_events");
    assert.equal(ev.length, 1);
    assert.equal(ev[0].actor_id, "u1");
    assert.equal(ev[0].actor_type, "staff");
    assert.equal(ev[0].action, "accept");
    assert.equal(ev[0].document_id, documentId);
    assert.equal(ev[0].firm_id, "f1");
    assert.ok(Date.parse(ev[0].created_at) > 0);
  });

  await t.test("validation: bad action, missing reason, bad body", async () => {
    const f = fixture();
    await f.upload();
    const post = (body) => f.json("POST", "/api/requests/r1/items/i1/review", { body });
    assert.equal((await post({ action: "nope" })).status, 400);
    assert.equal((await post({})).status, 400);
    assert.equal((await post({ action: "needs_replacement" })).status, 400);
    assert.equal((await post({ action: "needs_replacement", reason: "   " })).status, 400);
    assert.equal((await post({ action: "waive" })).status, 400);
    assert.equal((await post({ action: "accept", reason: 5 })).status, 400);
    const raw = await f.api("POST", "/api/requests/r1/items/i1/review");
    assert.equal(raw.status, 400);
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 0);
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "received");
  });

  await t.test("accept with nothing uploaded is 409; unknown item is 404", async () => {
    const f = fixture();
    const nothing = await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } });
    assert.equal(nothing.status, 409);
    assert.equal(nothing.body.currentStatus, "missing");
    assert.equal((await f.json("POST", "/api/requests/r1/items/nope/review", { body: { action: "accept" } })).status, 404);
  });

  await t.test("accepting twice conflicts and writes one event", async () => {
    const f = fixture();
    await f.upload();
    const post = () => f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } });
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 409);
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 1);
  });

  await t.test("replacement: reason stored, old doc rejected, second upload on the same link succeeds and supersedes", async () => {
    const f = fixture();
    const first = await f.upload();
    const res = await f.json("POST", "/api/requests/r1/items/i1/review", {
      body: { action: "needs_replacement", reason: "Image is blurry" },
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "needs_replacement");
    assert.equal(f.q("SELECT state FROM documents WHERE id=?", first.documentId)[0].state, "rejected");
    assert.equal(f.q("SELECT reason FROM review_events")[0].reason, "Image is blurry");

    const second = await f.upload("i1", first.link);
    assert.notEqual(second.documentId, first.documentId);
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "received");
    const view = await f.json("GET", "/api/requests/r1");
    const docs = view.body.items.find((i) => i.id === "i1").documents;
    assert.equal(docs.length, 2);
    assert.deepEqual(docs.map((d) => [d.version, d.state]), [[2, "received"], [1, "superseded"]]);
    // The new version can then be accepted.
    assert.equal((await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } })).status, 200);
    assert.equal(f.q("SELECT state FROM documents WHERE id=?", second.documentId)[0].state, "accepted");
  });

  await t.test("client session never exposes reasons or reviewer identity", async () => {
    const f = fixture();
    const first = await f.upload();
    await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "needs_replacement", reason: "SECRET-REASON" } });
    const res = await f.api("GET", `/api/session/${first.link.token}`, { user: null });
    const text = await res.text();
    assert.ok(!text.includes("SECRET-REASON"));
    assert.ok(!text.includes("u1"));
    assert.ok(text.includes("needs_replacement"));
  });

  await t.test("waive requires a reason and works on a missing item", async () => {
    const f = fixture();
    const res = await f.json("POST", "/api/requests/r1/items/i2/review", { body: { action: "waive", reason: "Not applicable" } });
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "waived");
    assert.equal(res.body.documentId, null);
    const ev = f.q("SELECT * FROM review_events")[0];
    assert.equal(ev.action, "waive");
    assert.equal(ev.document_id, null);
  });

  await t.test("download streams the file with attachment headers and a safe filename", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    const res = await f.api("GET", `/api/documents/${documentId}/download`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("Content-Type"), "application/pdf");
    assert.match(res.headers.get("Content-Disposition"), /^attachment; filename="pan _x_\.pdf"$/);
    assert.equal(res.headers.get("Cache-Control"), "no-store");
    assert.match(await res.text(), /^file-/);
  });

  await t.test("close: blocked until required items are accepted or waived, then closes", async () => {
    const f = fixture();
    await f.upload();
    const blocked = await f.json("POST", "/api/requests/r1/close");
    assert.equal(blocked.status, 409);
    await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } });
    const ok = await f.json("POST", "/api/requests/r1/close");
    assert.equal(ok.status, 200);
    assert.equal(ok.body.status, "closed");
    assert.equal(f.q("SELECT status FROM requests WHERE id='r1'")[0].status, "closed");
    assert.equal((await f.json("POST", "/api/requests/r1/close")).status, 409);
    const late = await f.json("POST", "/api/requests/r1/items/i2/review", { body: { action: "waive", reason: "x" } });
    assert.equal(late.status, 409);
  });

  await t.test("another firm gets 404 on every route and nothing changes", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    const other = { user: "u2" };
    assert.equal((await f.json("GET", "/api/requests/r1", other)).status, 404);
    assert.equal((await f.json("POST", "/api/requests/r1/items/i1/review", { ...other, body: { action: "accept" } })).status, 404);
    assert.equal((await f.json("POST", "/api/requests/r1/items/i1/review", { ...other, body: { action: "waive", reason: "x" } })).status, 404);
    assert.equal((await f.json("GET", `/api/documents/${documentId}/download`, other)).status, 404);
    assert.equal((await f.json("POST", "/api/requests/r1/close", other)).status, 404);
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "received");
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 0);
  });

  await t.test("atomic: document superseded mid-review aborts every write", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    // A newer version lands after the reviewer picked documentId.
    f.raw.exec(`INSERT INTO upload_sessions (id, firm_id, request_id, item_id, link_id, object_key, declared_content_type, declared_size, original_filename, expires_at, idempotency_key, state, completed_at)
      SELECT 'ses-new', firm_id, request_id, item_id, link_id, 'firms/f1/requests/r1/ses-new', 'application/pdf', 500, 'n.pdf', '2099-01-01', 'kx', 'completed', '2026-01-01' FROM upload_sessions LIMIT 1;
      INSERT INTO documents (id, firm_id, request_id, item_id, upload_session_id, object_key, content_type, size_bytes, etag, version)
      VALUES ('doc-new','f1','r1','i1','ses-new','firms/f1/requests/r1/ses-new','application/pdf',500,'e',2);`);
    const before = f.q("SELECT count(*) AS n FROM activities")[0].n;
    for (const action of ["accept", "needs_replacement"]) {
      await assert.rejects(
        reviewItem(f.db, { itemId: "i1", action, reason: "r", documentId, actor: { type: "staff", userId: "u1" }, scope: { firmId: "f1", requestId: "r1" } }),
        (e) => e instanceof StateConflict,
      );
    }
    assert.equal(f.q("SELECT status FROM request_items WHERE id='i1'")[0].status, "received");
    assert.equal(f.q("SELECT state FROM documents WHERE id=?", documentId)[0].state, "received");
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 0);
    assert.equal(f.q("SELECT count(*) AS n FROM activities")[0].n, before);
  });

  await t.test("atomic: item changed between validation and write aborts every write", async () => {
    const f = fixture();
    const { documentId } = await f.upload();
    const racing = { ...f.db, execute: f.db.execute.bind(f.db), async batch(q) {
      f.raw.exec("UPDATE request_items SET status='under_review' WHERE id='i1'");
      return f.db.batch(q);
    } };
    await assert.rejects(
      reviewItem(racing, { itemId: "i1", action: "accept", reason: "", documentId, actor: { type: "staff", userId: "u1" }, scope: { firmId: "f1", requestId: "r1" } }),
      (e) => e instanceof StateConflict && e.currentStatus === "under_review",
    );
    assert.equal(f.q("SELECT state FROM documents WHERE id=?", documentId)[0].state, "received");
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 0);
    assert.equal(f.q("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'")[0].n, 1);
  });

  await t.test("successful review writes transition activity and review event together", async () => {
    const f = fixture();
    await f.upload();
    await f.json("POST", "/api/requests/r1/items/i1/review", { body: { action: "accept" } });
    assert.equal(f.q("SELECT count(*) AS n FROM review_events")[0].n, 1);
    assert.equal(f.q("SELECT count(*) AS n FROM activities WHERE activity_type='item_transition'")[0].n, 2);
  });

  await t.test("a user with no firm membership is refused", async () => {
    const f = fixture();
    f.raw.exec("INSERT INTO users (id, username, password_hash) VALUES ('u3','three','x')");
    assert.equal((await f.json("GET", "/api/requests/r1", { user: "u3" })).status, 403);
  });
});
