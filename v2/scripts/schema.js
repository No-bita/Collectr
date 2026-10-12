import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

export const v2Dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const schemaPath = path.join(v2Dir, "src/db/schema.sql");
export const schemaQuery = `SELECT type, name, tbl_name, sql FROM sqlite_master
  WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
    AND name NOT IN ('d1_migrations', '_cf_METADATA')
  ORDER BY type, name;`;

export function migrationFiles() {
  const dir = path.join(v2Dir, "migrations");
  const files = fs.readdirSync(dir).filter((name) => name.endsWith(".sql")).sort();
  if (!files.length) throw new Error("No SQL migrations found");
  const numbers = files.map((name) => name.match(/^(\d{4})_.+\.sql$/)?.[1]);
  if (numbers.some((number) => !number) || new Set(numbers).size !== files.length) {
    throw new Error("Migrations need unique four-digit prefixes");
  }
  return files;
}

export function generateSchema() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "collectr-schema-"));
  const db = path.join(dir, "schema.db");
  try {
    for (const name of migrationFiles()) {
      const sql = fs.readFileSync(path.join(v2Dir, "migrations", name), "utf8");
      execFileSync("sqlite3", ["-bail", db], {
        input: `PRAGMA foreign_keys=ON;\nBEGIN;\n${sql}\nCOMMIT;\n`, encoding: "utf8",
      });
    }
    const violations = execFileSync("sqlite3", [db, "PRAGMA foreign_key_check;"], { encoding: "utf8" }).trim();
    if (violations) throw new Error(`Migration foreign-key violations: ${violations}`);
    return "-- Generated from v2/migrations by npm run db:schema:generate. Do not edit.\n"
      + execFileSync("sqlite3", [db, ".schema --nosys"], { encoding: "utf8" })
        .replace(/^CREATE TABLE (?!IF NOT EXISTS )/gm, "CREATE TABLE IF NOT EXISTS ");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

export function assertSchemaCurrent() {
  if (fs.readFileSync(schemaPath, "utf8") !== generateSchema()) {
    throw new Error("schema.sql is stale. Run npm run db:schema:generate and commit the result.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes("--check")) {
    assertSchemaCurrent();
    console.log("Generated schema is current.");
  } else {
    fs.writeFileSync(schemaPath, generateSchema());
    console.log("Regenerated src/db/schema.sql from migrations.");
  }
}
