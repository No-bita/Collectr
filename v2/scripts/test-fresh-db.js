import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { assertSchemaCurrent, migrationFiles, schemaQuery, v2Dir } from "./schema.js";

// No credentials or real resource IDs: every command is explicitly local and
// uses a throwaway config/persistence directory, never wrangler.local.toml.
assertSchemaCurrent();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "collectr-fresh-d1-"));
const config = path.join(temp, "wrangler.json");
const persist = path.join(temp, "state");
const schemaFile = path.join(temp, "d1-schema.json");
fs.writeFileSync(config, JSON.stringify({
  name: "collectr-migration-test", compatibility_date: "2026-05-24",
  d1_databases: [{ binding: "DB", database_name: "collectr-test-db",
    database_id: "00000000-0000-0000-0000-000000000000",
    migrations_dir: path.join(v2Dir, "migrations") }],
}));
const wrangler = path.join(v2Dir, "node_modules/wrangler/bin/wrangler.js");
const env = { ...process.env, CI: "true", WRANGLER_SEND_METRICS: "false" };
const args = ["--local", "--config", config, "--persist-to", persist];
function query(sql) {
  const output = execFileSync(process.execPath, [wrangler, "d1", "execute", "DB", ...args,
    "--command", sql, "--json"], { cwd: v2Dir, env, encoding: "utf8" });
  const result = JSON.parse(output);
  if (result.length !== 1 || !result[0].success) throw new Error("Local D1 query failed");
  return result[0].results;
}
try {
  execFileSync(process.execPath, [wrangler, "d1", "migrations", "apply", "DB", ...args], {
    cwd: v2Dir, env, stdio: "inherit",
  });
  const applied = query("SELECT name FROM d1_migrations ORDER BY name;").map((row) => row.name);
  if (JSON.stringify(applied) !== JSON.stringify(migrationFiles())) {
    throw new Error("Fresh D1 did not apply the complete migration chain");
  }
  if (query("PRAGMA foreign_key_check;").length) throw new Error("Fresh D1 has foreign-key violations");
  fs.writeFileSync(schemaFile, JSON.stringify(query(schemaQuery)));
  // Schema tests compare the actual fresh D1 database with the migration-built
  // schema; route tests retain their own isolated migration-built fixtures.
  const tests = fs.readdirSync(path.join(v2Dir, "tests"))
    .filter((name) => name.endsWith(".test.js")).sort().map((name) => path.join(v2Dir, "tests", name));
  execFileSync(process.execPath, ["--test", ...tests], {
    cwd: v2Dir, stdio: "inherit", env: { ...env, NO_EXTERNAL_NETWORK: "true",
      MOCK_WHATSAPP: "true", MOCK_GEMINI: "true", COLLECTR_FRESH_D1_SCHEMA: schemaFile },
  });
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
