import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { generateSchema, schemaPath, schemaQuery } from "../scripts/schema.js";

function normalize(rows) {
  return rows.map((row) => ({ ...row, sql: row.sql
    .replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|\s+/g,
      (part) => part.startsWith("--") || part.startsWith("/*") ? " " : /^\s+$/.test(part) ? " " : part)
    .replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\s+/g, (part) => /^\s+$/.test(part) ? " " : part)
    .trim() }));
}

function inspect(db) {
  return JSON.parse(execFileSync("sqlite3", ["-json", db, schemaQuery], { encoding: "utf8" }));
}

test("schema.sql is the exact generated snapshot of the migration chain", () => {
  assert.equal(fs.readFileSync(schemaPath, "utf8"), generateSchema(),
    "Run npm run db:schema:generate after adding migrations; never edit schema.sql by hand");
});

test("generated snapshot reloads with identical tables, indexes, checks and foreign keys", () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "collectr-parity-"));
  const db = path.join(temp, "snapshot.db");
  try {
    execFileSync("sqlite3", ["-bail", db], { input: generateSchema(), encoding: "utf8" });
    const schema = inspect(db);
    assert.ok(schema.some((row) => row.name === "request_items"));
    assert.ok(schema.some((row) => row.name === "client_links"));
    assert.equal(execFileSync("sqlite3", [db, "PRAGMA foreign_key_check;"], { encoding: "utf8" }).trim(), "");
    if (process.env.COLLECTR_FRESH_D1_SCHEMA) {
      // This is the schema of the actual Wrangler/Miniflare D1 instance that
      // test:fresh-db just built, not a mock or a second SQLite fixture.
      assert.deepEqual(normalize(schema), normalize(JSON.parse(fs.readFileSync(process.env.COLLECTR_FRESH_D1_SCHEMA, "utf8"))));
    }
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
