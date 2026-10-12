import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { sign } from "hono/jwt";
import app from "../src/index.js";

// node:sqlite requires Node >= 22.5 and the sqlite3 CLI may be absent on some
// runners (CI matrix includes Node 20.x). Detect both and skip cleanly instead
// of failing the whole job with ERR_UNKNOWN_BUILTIN_MODULE.
let DatabaseSync = null;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  // unavailable on this runtime; tests below skip
}
let sqliteCliAvailable = true;
try {
  execFileSync("sqlite3", ["--version"], { encoding: "utf8" });
} catch {
  sqliteCliAvailable = false;
}
const PREREQ_SKIP = !DatabaseSync
  ? "node:sqlite is unavailable (requires Node >= 22.5)"
  : !sqliteCliAvailable
    ? "sqlite3 CLI is unavailable"
    : false;

const JWT_SECRET = "test_firm_scoping_secret_key_12345";
const BASE = "https://collectrr.workers.dev";

const rootDir = path.resolve(process.cwd());
const v2Dir = fs.existsSync(path.join(rootDir, "src", "db", "schema.sql"))
  ? rootDir
  : path.join(rootDir, "v2");
const migrationsDir = path.join(v2Dir, "migrations");

function migrationFiles() {
  return fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
}

function applyMigration(dbPath, file) {
  const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  execFileSync("sqlite3", [dbPath], { input: sql, encoding: "utf8" });
}

// Minimal D1-compatible adapter over node:sqlite, matching what getDbClient expects.
function createD1Shim(db) {
  const isWrite = (sql) => /^\s*(insert|update|delete|create|drop|alter|pragma|replace)/i.test(sql);
  const wrap = (sql, args) => {
    const stmt = db.prepare(sql);
    return {
      all: async () => {
        if (isWrite(sql)) {
          const info = stmt.run(...args);
          return { results: [], success: true, meta: { changes: Number(info.changes) } };
        }
        return { results: stmt.all(...args), success: true };
      },
      run: async () => {
        const info = stmt.run(...args);
        return { success: true, meta: { changes: Number(info.changes) } };
      },
      first: async () => stmt.get(...args) ?? null,
    };
  };
  return {
    prepare: (sql) => ({
      bind: (...args) => wrap(sql, args),
      all: async () => wrap(sql, []).all(),
      run: async () => wrap(sql, []).run(),
      first: async () => wrap(sql, []).first(),
    }),
  };
}

function tmpDb(name) {
  return path.join(os.tmpdir(), `firm_scoping_${name}_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
}

test("Migration 0002: firms, memberships, backfill and NOT NULL firm ownership", { skip: PREREQ_SKIP }, async (t) => {
  await t.test("1. Applies cleanly to an empty database", () => {
    const dbPath = tmpDb("empty");
    try {
      for (const f of migrationFiles()) applyMigration(dbPath, f);
      const db = new DatabaseSync(dbPath);
      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
      assert.ok(tables.includes("firms"), "firms table must exist");
      assert.ok(tables.includes("firm_members"), "firm_members table must exist");
      const contactCols = db.prepare("PRAGMA table_info('contacts')").all().map(c => c.name);
      const requestCols = db.prepare("PRAGMA table_info('requests')").all().map(c => c.name);
      const activityCols = db.prepare("PRAGMA table_info('activities')").all().map(c => c.name);
      assert.ok(contactCols.includes("firm_id"), "contacts.firm_id must exist");
      assert.ok(requestCols.includes("firm_id"), "requests.firm_id must exist");
      assert.ok(activityCols.includes("firm_id"), "activities.firm_id must exist");
      db.close();
    } finally {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });

  await t.test("2. Backfills one firm per existing user and attaches their rows", () => {
    const dbPath = tmpDb("backfill");
    try {
      applyMigration(dbPath, "0001_personal_crm_schema.sql");
      const seed = `
        INSERT INTO users (id, username, password_hash) VALUES ('u_1', 'staffone', 'h'), ('u_2', 'stafftwo', 'h');
        INSERT INTO contacts (id, user_id, name, phone_number) VALUES ('c_1', 'u_1', 'Client One', '919111111111');
        INSERT INTO requests (id, user_id, contact_id, title) VALUES ('r_1', 'u_1', 'c_1', 'Send PAN');
        INSERT INTO activities (id, user_id, contact_id, activity_type, title) VALUES ('a_1', 'u_1', 'c_1', 'contact_created', 'Target Created');
      `;
      execFileSync("sqlite3", [dbPath], { input: seed, encoding: "utf8" });
      applyMigration(dbPath, "0002_firms_and_memberships.sql");

      const db = new DatabaseSync(dbPath);
      const firms = db.prepare("SELECT * FROM firms").all();
      const members = db.prepare("SELECT * FROM firm_members").all();
      assert.equal(firms.length, 2, "one firm per existing user");
      assert.equal(members.length, 2, "one owner membership per existing user");
      assert.ok(members.every(m => m.role === "owner"), "backfilled users own their firm");

      const contact = db.prepare("SELECT * FROM contacts WHERE id = 'c_1'").get();
      const request = db.prepare("SELECT * FROM requests WHERE id = 'r_1'").get();
      const activity = db.prepare("SELECT * FROM activities WHERE id = 'a_1'").get();
      const expectedFirm = members.find(m => m.user_id === "u_1").firm_id;
      assert.equal(contact.firm_id, expectedFirm, "contact attached to the user's firm");
      assert.equal(request.firm_id, expectedFirm, "request attached to the user's firm");
      assert.equal(activity.firm_id, expectedFirm, "activity attached to the user's firm");

      assert.throws(
        () => db.prepare("INSERT INTO contacts (id, user_id, firm_id, name, phone_number) VALUES ('c_x', 'u_1', NULL, 'No Firm', '919000000000')").run(),
        /NOT NULL constraint failed: contacts.firm_id/,
        "firm_id must be NOT NULL after backfill"
      );
      for (const t of ["contacts", "requests", "activities"]) {
        const col = db.prepare(`PRAGMA table_info('${t}')`).all().find(c => c.name === "firm_id");
        assert.equal(col.notnull, 1, `${t}.firm_id must be declared NOT NULL`);
      }
      db.close();
    } finally {
      if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    }
  });
});

test("Firm tenancy isolation across requests.js and contact routes", { skip: PREREQ_SKIP }, async (t) => {
  const dbPath = tmpDb("tenancy");
  for (const f of migrationFiles()) applyMigration(dbPath, f);

  const db = new DatabaseSync(dbPath);
  const seed = db.prepare;
  db.exec(`
    INSERT INTO users (id, username, password_hash, role) VALUES
      ('u_owner_a', 'OwnerA', 'h', 'agent'),
      ('u_staff_a', 'StaffA', 'h', 'agent'),
      ('u_owner_b', 'OwnerB', 'h', 'agent'),
      ('u_orphan', 'Orphan', 'h', 'agent');
    INSERT INTO firms (id, name) VALUES ('firm_a', 'Firm A'), ('firm_b', 'Firm B');
    INSERT INTO firm_members (firm_id, user_id, role) VALUES
      ('firm_a', 'u_owner_a', 'owner'),
      ('firm_a', 'u_staff_a', 'staff'),
      ('firm_b', 'u_owner_b', 'owner');
    INSERT INTO contacts (id, user_id, firm_id, name, phone_number) VALUES
      ('cnt_a', 'u_owner_a', 'firm_a', 'Client A', '919111111111'),
      ('cnt_b', 'u_owner_b', 'firm_b', 'Client B', '919222222222');
    INSERT INTO requests (id, user_id, firm_id, contact_id, title) VALUES
      ('req_a', 'u_owner_a', 'firm_a', 'cnt_a', 'Request A'),
      ('req_b', 'u_owner_b', 'firm_b', 'cnt_b', 'Request B');
    INSERT INTO request_items (id, request_id, title) VALUES
      ('itm_a', 'req_a', 'Item A'),
      ('itm_b', 'req_b', 'Item B');
  `);

  const env = { ENVIRONMENT: "production", JWT_SECRET, DB: createD1Shim(db) };
  const staffAToken = await sign({ id: "u_staff_a", username: "StaffA", role: "agent" }, JWT_SECRET);
  const orphanToken = await sign({ id: "u_orphan", username: "Orphan", role: "agent" }, JWT_SECRET);
  const auth = (token) => ({ Authorization: `Bearer ${token}`, "Content-Type": "application/json" });

  await t.test("3. Staff of firm A gets 404 for firm B contact, request and item IDs on every requests.js route", async () => {
    const createReq = await app.request(`${BASE}/api/contacts/cnt_b/requests`, {
      method: "POST", headers: auth(staffAToken), body: JSON.stringify({ title: "Cross-firm attempt" }),
    }, env);
    assert.equal(createReq.status, 404, "POST /api/contacts/:id/requests must 404 cross-firm");

    const updStatus = await app.request(`${BASE}/api/requests/req_b/status`, {
      method: "PATCH", headers: auth(staffAToken), body: JSON.stringify({ status: "completed" }),
    }, env);
    assert.equal(updStatus.status, 404, "PATCH /api/requests/:id/status must 404 cross-firm");

    const updItem = await app.request(`${BASE}/api/requests/req_b/items/itm_b`, {
      method: "PATCH", headers: auth(staffAToken), body: JSON.stringify({ status: "done" }),
    }, env);
    assert.equal(updItem.status, 404, "PATCH /api/requests/:requestId/items/:itemId must 404 cross-firm");

    const addItem = await app.request(`${BASE}/api/requests/req_b/items`, {
      method: "POST", headers: auth(staffAToken), body: JSON.stringify({ title: "Cross-firm item" }),
    }, env);
    assert.equal(addItem.status, 404, "POST /api/requests/:id/items must 404 cross-firm");

    // Firm B data must be untouched
    const reqB = db.prepare("SELECT status FROM requests WHERE id = 'req_b'").get();
    const itmB = db.prepare("SELECT status FROM request_items WHERE id = 'itm_b'").get();
    assert.equal(reqB.status, "open");
    assert.equal(itmB.status, "pending");
  });

  await t.test("4. Staff of firm A can use the same routes on firm A records (firm resolution works)", async () => {
    const createReq = await app.request(`${BASE}/api/contacts/cnt_a/requests`, {
      method: "POST", headers: auth(staffAToken),
      body: JSON.stringify({ title: "Staff request", items: ["PAN", "Aadhaar"] }),
    }, env);
    assert.equal(createReq.status, 201);
    const created = (await createReq.json()).request;
    const row = db.prepare("SELECT firm_id FROM requests WHERE id = ?").get(created.id);
    assert.equal(row.firm_id, "firm_a", "new request carries the caller's firm");
    const act = db.prepare("SELECT firm_id FROM activities WHERE request_id = ?").get(created.id);
    assert.equal(act.firm_id, "firm_a", "activity carries the caller's firm");

    const updStatus = await app.request(`${BASE}/api/requests/req_a/status`, {
      method: "PATCH", headers: auth(staffAToken), body: JSON.stringify({ status: "waiting_on_them" }),
    }, env);
    assert.equal(updStatus.status, 200);

    const addItem = await app.request(`${BASE}/api/requests/req_a/items`, {
      method: "POST", headers: auth(staffAToken), body: JSON.stringify({ title: "GST returns" }),
    }, env);
    assert.equal(addItem.status, 201);

    const updItem = await app.request(`${BASE}/api/requests/req_a/items/itm_a`, {
      method: "PATCH", headers: auth(staffAToken), body: JSON.stringify({ status: "done" }),
    }, env);
    assert.equal(updItem.status, 200);
    assert.equal(db.prepare("SELECT status FROM request_items WHERE id = 'itm_a'").get().status, "done");
  });

  await t.test("5. Contact list and workspace are firm-scoped", async () => {
    const list = await app.request(`${BASE}/api/contacts`, { headers: auth(staffAToken) }, env);
    assert.equal(list.status, 200);
    const listBody = await list.json();
    const ids = listBody.contacts.map(c => c.id);
    assert.ok(ids.includes("cnt_a"), "own firm contact visible");
    assert.ok(!ids.includes("cnt_b"), "other firm contact hidden");

    const ws = await app.request(`${BASE}/api/contacts/cnt_b`, { headers: auth(staffAToken) }, env);
    assert.ok([403, 404].includes(ws.status), "cross-firm workspace must not return data");
    const wsBody = await ws.json();
    assert.ok(!wsBody.contact, "no contact data leaks cross-firm");
  });

  await t.test("6. User with no firm membership cannot create firm-owned records", async () => {
    const res = await app.request(`${BASE}/api/contacts/cnt_a/requests`, {
      method: "POST", headers: auth(orphanToken), body: JSON.stringify({ title: "Orphan request" }),
    }, env);
    assert.equal(res.status, 403);
  });

  db.close();
  if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
});
