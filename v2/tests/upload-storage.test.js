import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildObjectKey, createUploadSession, getUploadSession, endUploadSession } from "../src/db/upload_sessions.js";
import { getDocument, listItemDocuments } from "../src/db/documents.js";
// node:sqlite needs Node 22.5+. CI also runs Node 20, where this suite is skipped.
let DatabaseSync;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  /* unsupported runtime */
}
const SKIP = DatabaseSync ? false : "node:sqlite is not available on this Node version (needs 22.5+)";

const v2Dir = fs.existsSync(path.join(process.cwd(), "src", "db", "schema.sql"))
  ? process.cwd()
  : path.join(process.cwd(), "v2");
const migrationsDir = path.join(v2Dir, "migrations");

function migrationFiles() {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

function dbFromMigrations() {
  const raw = new DatabaseSync(":memory:");
  for (const f of migrationFiles()) raw.exec(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  return raw;
}

// Minimal D1-style adapter over node:sqlite so the helpers run against a real schema.
function adapter(raw) {
  async function execute(q) {
    const sql = typeof q === "string" ? q : q.sql;
    const args = typeof q === "string" ? [] : q.args || [];
    const stmt = raw.prepare(sql);
    if (/^\s*(select|with)/i.test(sql)) {
      const rows = stmt.all(...args).map((r) => ({ ...r }));
      return { rows, results: rows, changes: rows.length };
    }
    const info = stmt.run(...args);
    return { rows: [], results: [], changes: Number(info.changes), rowsAffected: Number(info.changes) };
  }
  return {
    execute,
    async batch(queries) {
      raw.exec("BEGIN");
      try {
        const results = [];
        for (const q of queries) results.push(await execute(q));
        raw.exec("COMMIT");
        return results;
      } catch (err) {
        raw.exec("ROLLBACK");
        throw err;
      }
    },
  };
}

// Two firms, one user each, one contact and one open request per firm.
function seed(raw) {
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES
              ('u1', 'staff-a', 'x'),
              ('u2', 'staff-b', 'x');
            INSERT INTO firms (id, name) VALUES ('f1', 'Firm A'), ('f2', 'Firm B');
            INSERT INTO firm_members (firm_id, user_id, role) VALUES
              ('f1', 'u1', 'owner'),
              ('f2', 'u2', 'owner');
            INSERT INTO contacts (id, user_id, firm_id, name, phone_number) VALUES
              ('c1', 'u1', 'f1', 'Client A', '919999999901'),
              ('c2', 'u2', 'f2', 'Client B', '919999999902');
            INSERT INTO requests (id, user_id, firm_id, contact_id, title, status) VALUES
              ('r1', 'u1', 'f1', 'c1', 'FY25 documents', 'open'),
              ('r2', 'u2', 'f2', 'c2', 'FY25 documents', 'open');`);
}



function fixture() {
  const raw = dbFromMigrations();
  raw.exec("PRAGMA foreign_keys = ON");
  seed(raw);
  raw.exec(`INSERT INTO request_items(id,request_id,firm_id,title) VALUES ('i1','r1','f1','PAN'),('i2','r2','f2','PAN');
    INSERT INTO client_links(id,firm_id,request_id,token_hash,expires_at) VALUES ('l1','f1','r1','hash1','2099-01-01'),('l2','f2','r2','hash2','2099-01-01');`);
  return { raw, db: adapter(raw) };
}
const intent = { firmId: "f1", requestId: "r1", itemId: "i1", linkId: "l1",
  declaredContentType: "application/pdf", declaredSize: 123, originalFilename: "Private Client PAN.pdf",
  expiresAt: "2099-01-01T00:00:00.000Z", idempotencyKey: "retry-1" };
function insertDocument(raw, session, { id = "d1", version = 1, itemId = "i1", firmId = "f1", requestId = "r1", key = session.object_key } = {}) {
  raw.prepare(`INSERT INTO documents(id,firm_id,request_id,item_id,upload_session_id,object_key,content_type,size_bytes,etag,version)
    VALUES(?,?,?,?,?,?,?,123,'etag',?)`).run(id,firmId,requestId,itemId,session.id,key,"application/pdf",version);
}

test("upload storage schema and models", { skip: SKIP }, async t => {
  await t.test("empty migration chain creates both tables and leaves no FK violations", () => {
    const {raw} = fixture();
    assert.equal(raw.prepare("SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('documents','upload_sessions')").get().n, 2);
    assert.deepEqual(raw.prepare("PRAGMA foreign_key_check").all(), []);
  });
  await t.test("migration applies on a populated existing DB without changing data", () => {
    const raw = new DatabaseSync(":memory:");
    const files = migrationFiles();
    for (const f of files.filter(f => f < "0006")) raw.exec(fs.readFileSync(path.join(migrationsDir,f),"utf8"));
    seed(raw);
    const before = JSON.stringify(raw.prepare("SELECT * FROM requests ORDER BY id").all());
    raw.exec(fs.readFileSync(path.join(migrationsDir, files.find(f => f.startsWith("0006"))),"utf8"));
    assert.equal(JSON.stringify(raw.prepare("SELECT * FROM requests ORDER BY id").all()), before);
  });
  await t.test("object keys contain IDs only and reject unsafe IDs", () => {
    assert.equal(buildObjectKey({firmId:"f1",requestId:"r1",sessionId:"s1"}),"firms/f1/requests/r1/s1");
    for (const bad of ["", "../escape", "client name", undefined]) assert.throws(() => buildObjectKey({firmId:bad,requestId:"r1",sessionId:"s1"}));
  });
  await t.test("intent creation creates no documents; retries reuse one session", async () => {
    const {raw,db} = fixture();
    const a = await createUploadSession(db,intent);
    const b = await createUploadSession(db,intent);
    assert.equal(a.ok,true); assert.equal(a.reused,false); assert.equal(b.reused,true);
    assert.equal(a.session.id,b.session.id);
    assert.equal(a.session.state,"initiated");
    assert.equal(a.session.object_key,`firms/f1/requests/r1/${a.session.id}`);
    assert.equal(raw.prepare("SELECT count(*) n FROM documents").get().n,0);
    assert.equal(raw.prepare("SELECT count(*) n FROM upload_sessions").get().n,1);
  });
  await t.test("same retry key with changed metadata is rejected", async () => {
    const {db} = fixture(); await createUploadSession(db,intent);
    assert.deepEqual(await createUploadSession(db,{...intent,declaredSize:999}),{ok:false,reason:"idempotency_conflict"});
  });
  await t.test("idempotency is per link, not global", async () => {
    const {db} = fixture(); await createUploadSession(db,intent);
    const b = await createUploadSession(db,{...intent,firmId:"f2",requestId:"r2",itemId:"i2",linkId:"l2"});
    assert.equal(b.ok,true); assert.equal(b.reused,false);
  });
  await t.test("model rejects foreign firm's item/link/request combinations", async () => {
    const {raw,db} = fixture();
    for (const patch of [{firmId:"f2"},{itemId:"i2"},{linkId:"l2"},{requestId:"r2"}]) {
      assert.deepEqual(await createUploadSession(db,{...intent,...patch}),{ok:false,reason:"scope_not_found"});
    }
    assert.equal(raw.prepare("SELECT count(*) n FROM upload_sessions").get().n,0);
  });
  await t.test("foreign key constraints reject tenant mixing even through raw SQL", async () => {
    const {raw,db} = fixture(); const {session} = await createUploadSession(db,intent);
    for (const [column,value] of [["firm_id","f2"],["request_id","r2"],["item_id","i2"],["link_id","l2"]]) {
      assert.throws(() => raw.prepare(`UPDATE upload_sessions SET ${column}=? WHERE id=?`).run(value,session.id));
    }
    assert.throws(() => insertDocument(raw,session,{firmId:"f2",requestId:"r2",itemId:"i2"}));
    assert.throws(() => insertDocument(raw,session,{key:"wrong-key"}));
  });
  await t.test("unique object keys, per-link idempotency and valid states are enforced", async () => {
    const {raw,db} = fixture(); const {session} = await createUploadSession(db,intent);
    assert.throws(() => raw.exec(`INSERT INTO upload_sessions SELECT * FROM upload_sessions`));
    assert.throws(() => raw.prepare("UPDATE upload_sessions SET object_key='other' WHERE id=?").run(session.id));
    assert.throws(() => raw.prepare("UPDATE upload_sessions SET state='received' WHERE id=?").run(session.id));
    assert.throws(() => raw.prepare("UPDATE upload_sessions SET state='completed' WHERE id=?").run(session.id));
    assert.throws(() => raw.prepare("UPDATE upload_sessions SET declared_size=0 WHERE id=?").run(session.id));
  });
  await t.test("document session uniqueness and per-item versions are enforced", async () => {
    const {raw,db} = fixture(); const {session} = await createUploadSession(db,intent);
    insertDocument(raw,session);
    assert.throws(() => insertDocument(raw,session,{id:"d2",version:2}));
    const b = await createUploadSession(db,{...intent,idempotencyKey:"retry-2"});
    assert.throws(() => insertDocument(raw,b.session,{id:"d2"}));
    insertDocument(raw,b.session,{id:"d2",version:2});
    assert.throws(() => raw.exec("UPDATE documents SET state='unknown' WHERE id='d1'"));
    assert.throws(() => raw.exec("UPDATE documents SET version=0 WHERE id='d1'"));
  });
  await t.test("all read helpers are firm-scoped", async () => {
    const {raw,db} = fixture(); const {session} = await createUploadSession(db,intent); insertDocument(raw,session);
    assert.equal((await getUploadSession(db,{firmId:"f1",sessionId:session.id})).id,session.id);
    assert.equal(await getUploadSession(db,{firmId:"f2",sessionId:session.id}),null);
    assert.equal((await getDocument(db,{firmId:"f1",documentId:"d1"})).id,"d1");
    assert.equal(await getDocument(db,{firmId:"f2",documentId:"d1"}),null);
    assert.equal((await listItemDocuments(db,{firmId:"f1",requestId:"r1",itemId:"i1"})).length,1);
    assert.deepEqual(await listItemDocuments(db,{firmId:"f2",requestId:"r1",itemId:"i1"}),[]);
  });
  await t.test("failure/expiry updates cannot cross firms or complete a session", async () => {
    const {db} = fixture(); const {session} = await createUploadSession(db,intent);
    assert.deepEqual(await endUploadSession(db,{firmId:"f2",sessionId:session.id,state:"failed"}),{changed:false});
    await assert.rejects(endUploadSession(db,{firmId:"f1",sessionId:session.id,state:"completed"}));
    assert.deepEqual(await endUploadSession(db,{firmId:"f1",sessionId:session.id,state:"expired"}),{changed:true});
    assert.deepEqual(await endUploadSession(db,{firmId:"f1",sessionId:session.id,state:"failed"}),{changed:false});
  });
  await t.test("request deletion cascades both intent and documents", async () => {
    const {raw,db} = fixture(); const {session} = await createUploadSession(db,intent); insertDocument(raw,session);
    raw.exec("DELETE FROM requests WHERE id='r1'");
    assert.equal(raw.prepare("SELECT count(*) n FROM documents").get().n,0);
    assert.equal(raw.prepare("SELECT count(*) n FROM upload_sessions").get().n,0);
  });
  await t.test("invalid intent metadata rejected before database use", async () => {
    const {db} = fixture();
    for (const patch of [{declaredSize:0},{declaredSize:1.1},{declaredSize:NaN},{originalFilename:""},{idempotencyKey:""},{expiresAt:"invalid"}]) {
      await assert.rejects(createUploadSession(db,{...intent,...patch}),TypeError);
    }
  });
});
