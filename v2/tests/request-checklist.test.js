import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  handleCreateRequest,
  handleAddRequestItem,
  handleUpdateRequestItem,
} from "../src/api/requests.js";

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
const NEW_ITEM_STATUSES = ["missing", "received", "under_review", "accepted", "needs_replacement", "waived"];

function migrationFiles(upTo) {
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .filter((f) => !upTo || f <= upTo);
}

function dbFromMigrations(files) {
  const raw = new DatabaseSync(":memory:");
  for (const f of files) raw.exec(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
  return raw;
}

// Minimal D1-style adapter over node:sqlite so handlers run against a real schema.
function adapter(raw) {
  return {
    async execute(q) {
      const sql = typeof q === "string" ? q : q.sql;
      const args = typeof q === "string" ? [] : q.args || [];
      const stmt = raw.prepare(sql);
      if (/^\s*(select|with)/i.test(sql)) {
        const rows = stmt.all(...args).map((r) => ({ ...r }));
        return { rows, results: rows, changes: rows.length };
      }
      const info = stmt.run(...args);
      return { rows: [], results: [], changes: Number(info.changes), rowsAffected: Number(info.changes) };
    },
  };
}

function ctx(db, { params = {}, body = {}, userId = "u1" } = {}) {
  let out;
  return {
    env: { DB: db },
    get: () => ({ id: userId }),
    req: { param: (k) => params[k], json: async () => body },
    json: (payload, status = 200) => ((out = { status, payload }), out),
  };
}

function seed(raw) {
  raw.exec(`INSERT INTO users (id, username, password_hash) VALUES ('u1', 'a', 'x');
            INSERT INTO contacts (id, user_id, name, phone_number) VALUES ('c1', 'u1', 'Client', '919999999999');`);
}

test("Migration 0003: request checklist model", { skip: SKIP }, async (t) => {
  await t.test("applies on an empty database and sets the new item defaults", () => {
    const raw = dbFromMigrations(migrationFiles());
    seed(raw);
    raw.exec(`INSERT INTO requests (id, user_id, contact_id, title) VALUES ('r1','u1','c1','R');
              INSERT INTO request_items (id, request_id, title) VALUES ('i1','r1','PAN');`);
    const item = raw.prepare("SELECT * FROM request_items WHERE id='i1'").get();
    assert.equal(item.status, "missing");
    assert.equal(item.required, 1);
    assert.equal(item.allowed_types, "pdf,jpg,png");
    assert.equal(item.max_bytes, 15 * 1024 * 1024);
    const cols = raw.prepare("PRAGMA table_info(request_items)").all().map((c) => c.name);
    assert.ok(!cols.includes("file_url") && !cols.includes("s3_key"));
    const reqCols = raw.prepare("PRAGMA table_info(requests)").all().map((c) => c.name);
    assert.ok(reqCols.includes("service_type") && reqCols.includes("period_label"));
  });

  await t.test("backfills existing data: pending->missing, done->accepted, waived kept, positions assigned", () => {
    const raw = dbFromMigrations(migrationFiles("0001_personal_crm_schema.sql"));
    seed(raw);
    raw.exec(`INSERT INTO requests (id, user_id, contact_id, title, status) VALUES ('r1','u1','c1','R','waiting_on_them');
      INSERT INTO request_items (id, request_id, title, status, created_at) VALUES
        ('i1','r1','A','pending','2026-01-01 10:00:00'),
        ('i2','r1','B','done','2026-01-01 10:00:01'),
        ('i3','r1','C','waived','2026-01-01 10:00:02'),
        ('i4','r1','D','weird','2026-01-01 10:00:03');`);
    raw.exec(fs.readFileSync(path.join(migrationsDir, "0003_request_checklist_model.sql"), "utf8"));
    const rows = raw.prepare("SELECT id, status, position FROM request_items ORDER BY position").all();
    assert.deepEqual(rows.map((r) => [r.id, r.status, r.position]), [
      ["i1", "missing", 0],
      ["i2", "accepted", 1],
      ["i3", "waived", 2],
      ["i4", "missing", 3],
    ]);
    for (const r of rows) assert.ok(NEW_ITEM_STATUSES.includes(r.status));
    // existing request statuses are left alone
    assert.equal(raw.prepare("SELECT status FROM requests WHERE id='r1'").get().status, "waiting_on_them");
  });

  await t.test("rejects an item status outside the new set", () => {
    const raw = dbFromMigrations(migrationFiles());
    seed(raw);
    raw.exec(`INSERT INTO requests (id, user_id, contact_id, title) VALUES ('r1','u1','c1','R');`);
    assert.throws(() => raw.exec(`INSERT INTO request_items (id, request_id, title, status) VALUES ('x','r1','T','pending');`));
  });
});

test("Request checklist handlers", { skip: SKIP }, async (t) => {
  function setup() {
    const raw = dbFromMigrations(migrationFiles());
    seed(raw);
    return { raw, db: adapter(raw) };
  }
  async function createRequest(db, body) {
    return handleCreateRequest(ctx(db, { params: { id: "c1" }, body: { title: "GST filing", ...body } }));
  }

  await t.test("creates a request with 3 items: all missing, stable positions, defaults applied", async () => {
    const { db, raw } = setup();
    const res = await createRequest(db, {
      serviceType: "GST filing",
      periodLabel: "Q2 FY26-27",
      items: ["PAN", { title: "Bank statement", required: false, allowedTypes: ["PDF", ".jpg"], maxBytes: 1000 }, "  ", "Invoices"],
    });
    assert.equal(res.status, 201);
    const { request } = res.payload;
    assert.equal(request.status, "open");
    assert.equal(request.serviceType, "GST filing");
    assert.equal(request.items.length, 3);
    assert.deepEqual(request.items.map((i) => i.title), ["PAN", "Bank statement", "Invoices"]);
    assert.deepEqual(request.items.map((i) => i.position), [0, 1, 2]);
    assert.ok(request.items.every((i) => i.status === "missing"));
    assert.equal(request.items[0].required, true);
    assert.equal(request.items[1].required, false);
    assert.equal(request.items[1].allowedTypes, "pdf,jpg");
    assert.equal(request.items[1].maxBytes, 1000);
    const stored = raw.prepare("SELECT title, position FROM request_items ORDER BY position").all();
    assert.deepEqual(stored.map((r) => r.position), [0, 1, 2]);
  });

  await t.test("can create a draft request; rejects an invalid starting status and bad item fields", async () => {
    const { db } = setup();
    assert.equal((await createRequest(db, { status: "draft" })).payload.request.status, "draft");
    assert.equal((await createRequest(db, { status: "closed" })).status, 400);
    assert.equal((await createRequest(db, { items: [{ title: "X", maxBytes: -1 }] })).status, 400);
    assert.equal((await createRequest(db, { items: [{ title: "X", allowedTypes: "p/df" }] })).status, 400);
  });

  await t.test("items can be added and edited on draft and open requests", async () => {
    const { db } = setup();
    for (const status of ["draft", "open"]) {
      const { request } = (await createRequest(db, { status, items: ["A", "B"] })).payload;
      const add = await handleAddRequestItem(ctx(db, { params: { id: request.id }, body: { title: "C", description: "Last year's" } }));
      assert.equal(add.status, 201);
      assert.equal(add.payload.item.position, 2);
      assert.equal(add.payload.item.status, "missing");
      const edit = await handleUpdateRequestItem(
        ctx(db, { params: { requestId: request.id, itemId: request.items[0].id }, body: { title: "A2", required: false, position: 5 } })
      );
      assert.equal(edit.status, 200);
      assert.equal(edit.payload.item.title, "A2");
      assert.equal(edit.payload.item.required, false);
      assert.equal(edit.payload.item.position, 5);
    }
  });

  await t.test("items cannot be added or edited on a closed or cancelled request (409)", async () => {
    const { db, raw } = setup();
    for (const locked of ["closed", "cancelled", "completed"]) {
      const { request } = (await createRequest(db, { items: ["A"] })).payload;
      raw.prepare("UPDATE requests SET status = ? WHERE id = ?").run(locked, request.id);
      const add = await handleAddRequestItem(ctx(db, { params: { id: request.id }, body: { title: "B" } }));
      assert.equal(add.status, 409, `add on ${locked}`);
      const edit = await handleUpdateRequestItem(
        ctx(db, { params: { requestId: request.id, itemId: request.items[0].id }, body: { title: "Z" } })
      );
      assert.equal(edit.status, 409, `edit on ${locked}`);
    }
  });

  await t.test("PATCH cannot set received, accepted, under_review, needs_replacement or the removed labels", async () => {
    const { db, raw } = setup();
    const { request } = (await createRequest(db, { items: ["A"] })).payload;
    const params = { requestId: request.id, itemId: request.items[0].id };
    for (const status of ["received", "accepted", "under_review", "needs_replacement", "pending", "done"]) {
      const res = await handleUpdateRequestItem(ctx(db, { params, body: { status } }));
      assert.equal(res.status, 400, status);
    }
    assert.equal(raw.prepare("SELECT status FROM request_items WHERE id = ?").get(params.itemId).status, "missing");
    assert.equal((await handleUpdateRequestItem(ctx(db, { params, body: { status: "waived" } }))).status, 200);
    assert.equal((await handleUpdateRequestItem(ctx(db, { params, body: { status: "missing" } }))).status, 200);
  });

  await t.test("unknown item returns 404, empty patch returns 400", async () => {
    const { db } = setup();
    const { request } = (await createRequest(db, { items: ["A"] })).payload;
    assert.equal((await handleUpdateRequestItem(ctx(db, { params: { requestId: request.id, itemId: "nope" }, body: { title: "x" } }))).status, 404);
    assert.equal((await handleUpdateRequestItem(ctx(db, { params: { requestId: request.id, itemId: request.items[0].id }, body: {} }))).status, 400);
  });

  await t.test("another user cannot add or edit items on someone else's request (404, nothing changes)", async () => {
    const { db, raw } = setup();
    raw.exec("INSERT INTO users (id, username, password_hash) VALUES ('u2', 'b', 'x');");
    const { request } = (await createRequest(db, { items: ["A"] })).payload;
    const add = await handleAddRequestItem(ctx(db, { userId: "u2", params: { id: request.id }, body: { title: "Sneaky" } }));
    assert.equal(add.status, 404);
    const edit = await handleUpdateRequestItem(
      ctx(db, { userId: "u2", params: { requestId: request.id, itemId: request.items[0].id }, body: { title: "Hijacked" } })
    );
    assert.equal(edit.status, 404);
    const rows = raw.prepare("SELECT title FROM request_items WHERE request_id = ?").all(request.id);
    assert.deepEqual(rows.map((r) => r.title), ["A"]);
  });
});
