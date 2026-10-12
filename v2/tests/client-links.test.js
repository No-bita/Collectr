import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  createLink,
  resolveLink,
  revokeLink,
  regenerateLink,
  hashToken,
} from "../src/db/client_links.js";

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

function linkRow(raw, id) {
  return raw.prepare("SELECT * FROM client_links WHERE id = ?").get(id);
}

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const PAST = new Date(Date.now() - 60 * 1000).toISOString();

test("Migration 0005: client_links table", { skip: SKIP }, async (t) => {
  await t.test("applies on an empty database with the expected shape", () => {
    const raw = dbFromMigrations();
    const cols = raw.prepare("PRAGMA table_info(client_links)").all().map((c) => c.name);
    assert.deepEqual(cols.sort(), [
      "created_at",
      "created_by",
      "expires_at",
      "firm_id",
      "id",
      "last_used_at",
      "request_id",
      "revoked_at",
      "token_hash",
    ]);
    // No fingerprint, IP or user-agent tracking anywhere in the link model.
    assert.ok(!cols.some((c) => /fingerprint|ip|user_?agent/i.test(c)));
    const indexes = raw.prepare("PRAGMA index_list(client_links)").all().map((i) => i.name);
    assert.ok(indexes.includes("idx_client_links_request"));
    assert.ok(indexes.includes("idx_client_links_token_hash"));
  });
});

test("client link helpers", { skip: SKIP }, async (t) => {
  await t.test("createLink stores only the SHA-256 hash, never the raw token", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);

    const res = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1" });
    assert.equal(res.ok, true);
    const { token, link } = res;
    assert.match(token, /^[A-Za-z0-9_-]{43}$/); // 32 random bytes, base64url

    const row = linkRow(raw, link.id);
    assert.equal(row.token_hash, await hashToken(token));
    assert.match(row.token_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(row.token_hash, token);
    // The raw token appears in no column of any link row.
    const all = raw.prepare("SELECT * FROM client_links").all();
    for (const r of all) {
      for (const value of Object.values(r)) assert.ok(String(value) !== token);
    }
  });

  await t.test("two generated tokens never collide", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const a = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1" });
    const b = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1" });
    assert.notEqual(a.token, b.token);
    assert.notEqual(a.link.token_hash, b.link.token_hash);
  });

  await t.test("a valid token resolves to its link and request", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const { token, link } = await createLink(db, {
      firmId: "f1",
      requestId: "r1",
      createdBy: "u1",
      expiresAt: FUTURE,
    });

    const resolved = await resolveLink(db, token);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.link.id, link.id);
    assert.equal(resolved.link.request_id, "r1");
    assert.equal(resolved.request.id, "r1");
    assert.equal(resolved.request.status, "open");
    assert.equal(linkRow(raw, link.id).last_used_at !== null, true);
  });

  await t.test("an expired token does not resolve", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const { token } = await createLink(db, {
      firmId: "f1",
      requestId: "r1",
      createdBy: "u1",
      expiresAt: PAST,
    });
    const resolved = await resolveLink(db, token);
    assert.deepEqual(resolved, { ok: false, reason: "expired" });
  });

  await t.test("a revoked token does not resolve", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const { token, link } = await createLink(db, {
      firmId: "f1",
      requestId: "r1",
      createdBy: "u1",
      expiresAt: FUTURE,
    });
    const revoked = await revokeLink(db, { firmId: "f1", linkId: link.id });
    assert.equal(revoked.ok, true);
    assert.deepEqual(await resolveLink(db, token), { ok: false, reason: "revoked" });
  });

  await t.test("an unknown token does not resolve", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    assert.deepEqual(await resolveLink(db, "nope-not-a-real-token"), { ok: false, reason: "not_found" });
    assert.deepEqual(await resolveLink(db, ""), { ok: false, reason: "not_found" });
  });

  await t.test("a token for a closed request does not resolve", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const { token } = await createLink(db, {
      firmId: "f1",
      requestId: "r1",
      createdBy: "u1",
      expiresAt: FUTURE,
    });
    raw.exec("UPDATE requests SET status = 'completed' WHERE id = 'r1'");
    assert.deepEqual(await resolveLink(db, token), { ok: false, reason: "request_closed" });
  });

  await t.test("helpers are firm-scoped: firm B cannot create or revoke on firm A's request", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);

    const created = await createLink(db, { firmId: "f2", requestId: "r1", createdBy: "u2" });
    assert.deepEqual(created, { ok: false, reason: "request_not_found" });
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n, 0);

    const { token, link } = await createLink(db, {
      firmId: "f1",
      requestId: "r1",
      createdBy: "u1",
      expiresAt: FUTURE,
    });
    assert.deepEqual(await revokeLink(db, { firmId: "f2", linkId: link.id }), {
      ok: false,
      reason: "not_found",
    });
    assert.equal((await resolveLink(db, token)).ok, true); // untouched
  });

  await t.test("regenerateLink revokes active links and issues a working replacement", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const first = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1", expiresAt: FUTURE });
    const second = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1", expiresAt: FUTURE });

    const regen = await regenerateLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1", expiresAt: FUTURE });
    assert.equal(regen.ok, true);
    assert.equal(regen.revokedCount, 2);

    assert.deepEqual(await resolveLink(db, first.token), { ok: false, reason: "revoked" });
    assert.deepEqual(await resolveLink(db, second.token), { ok: false, reason: "revoked" });
    const resolved = await resolveLink(db, regen.token);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.link.id, regen.link.id);
  });

  await t.test("regenerateLink rejects another firm's request", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    assert.deepEqual(await regenerateLink(db, { firmId: "f2", requestId: "r1", createdBy: "u2" }), {
      ok: false,
      reason: "request_not_found",
    });
  });

  await t.test("revoking twice is idempotent", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    const { link } = await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1", expiresAt: FUTURE });
    assert.deepEqual(await revokeLink(db, { firmId: "f1", linkId: link.id }), { ok: true, alreadyRevoked: false });
    assert.deepEqual(await revokeLink(db, { firmId: "f1", linkId: link.id }), { ok: true, alreadyRevoked: true });
  });

  await t.test("cascading delete of a request removes its links", async () => {
    const raw = dbFromMigrations();
    seed(raw);
    const db = adapter(raw);
    raw.exec("PRAGMA foreign_keys = ON");
    await createLink(db, { firmId: "f1", requestId: "r1", createdBy: "u1", expiresAt: FUTURE });
    raw.exec("DELETE FROM requests WHERE id = 'r1'");
    assert.equal(raw.prepare("SELECT COUNT(*) AS n FROM client_links").get().n, 0);
  });
});
