import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = path.resolve(process.cwd());
// Handle running from root or from v2 directory
const v2Dir = fs.existsSync(path.join(rootDir, "src", "db", "schema.sql"))
  ? rootDir
  : path.join(rootDir, "v2");

test("Deep Database Schema Parity Tests (schema.sql vs Migrations)", async (t) => {
  const schemaSqlPath = path.join(v2Dir, "src", "db", "schema.sql");
  const migrationsDir = path.join(v2Dir, "migrations");

  assert.ok(fs.existsSync(schemaSqlPath), "schema.sql must exist");
  assert.ok(fs.existsSync(migrationsDir), "migrations directory must exist");

  const tmpSchemaDb = path.join(v2Dir, `tmp_schema_${Date.now()}.db`);
  const tmpMigrationsDb = path.join(v2Dir, `tmp_migrations_${Date.now()}.db`);

  try {
    // 1. Build DB from schema.sql
    const schemaSql = fs.readFileSync(schemaSqlPath, "utf8");
    execFileSync("sqlite3", [tmpSchemaDb], { input: schemaSql, encoding: "utf8" });

    // 2. Build DB from sequential migrations
    const migrationFiles = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const migFile of migrationFiles) {
      const migSql = fs.readFileSync(path.join(migrationsDir, migFile), "utf8");
      execFileSync("sqlite3", [tmpMigrationsDb], { input: migSql, encoding: "utf8" });
    }

    // Helper to extract complete schema definition for a database
    function inspectDatabase(dbPath) {
      const tablesJson = execFileSync(
        "sqlite3",
        [
          dbPath,
          `SELECT json_group_array(name) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'migration_%' ORDER BY name;`,
        ],
        { encoding: "utf8" }
      ).trim();

      const tableNames = JSON.parse(tablesJson || "[]");
      const schema = {};

      for (const table of tableNames) {
        // Table columns
        const colsRaw = execFileSync(
          "sqlite3",
          [
            dbPath,
            `SELECT json_group_array(json_object('name', name, 'type', upper(type), 'notnull', "notnull", 'dflt_value', dflt_value, 'pk', pk)) FROM pragma_table_info('${table}');`,
          ],
          { encoding: "utf8" }
        ).trim();

        const cols = JSON.parse(colsRaw || "[]").sort((a, b) => a.name.localeCompare(b.name));

        // Table indexes
        const idxRaw = execFileSync(
          "sqlite3",
          [
            dbPath,
            `SELECT json_group_array(json_object('name', name, 'unique', "unique")) FROM pragma_index_list('${table}') WHERE name NOT LIKE 'sqlite_%';`,
          ],
          { encoding: "utf8" }
        ).trim();

        const indexes = JSON.parse(idxRaw || "[]").sort((a, b) => a.name.localeCompare(b.name));

        schema[table] = {
          columns: cols,
          indexes: indexes,
        };
      }

      return schema;
    }

    const schemaDef = inspectDatabase(tmpSchemaDb);
    const migrationsDef = inspectDatabase(tmpMigrationsDb);

    await t.test("1. Tables created by schema.sql and migrations are identical", () => {
      const schemaTables = Object.keys(schemaDef).sort();
      const migrationTables = Object.keys(migrationsDef).sort();

      assert.deepEqual(
        schemaTables,
        migrationTables,
        `Table lists diverged between schema.sql and migrations chain.\nSchema tables: ${schemaTables.join(
          ", "
        )}\nMigration tables: ${migrationTables.join(", ")}`
      );
    });

    await t.test("2. Column names, types, and primary keys match across all tables", () => {
      for (const table of Object.keys(schemaDef)) {
        assert.deepEqual(
          schemaDef[table].columns,
          migrationsDef[table].columns,
          `Columns diverged on table "${table}"`
        );
      }
    });

    await t.test("3. Table indexes and uniqueness constraints match", () => {
      for (const table of Object.keys(schemaDef)) {
        assert.deepEqual(
          schemaDef[table].indexes,
          migrationsDef[table].indexes,
          `Indexes/constraints diverged on table "${table}"`
        );
      }
    });
  } finally {
    // Cleanup temporary files
    if (fs.existsSync(tmpSchemaDb)) fs.unlinkSync(tmpSchemaDb);
    if (fs.existsSync(tmpMigrationsDb)) fs.unlinkSync(tmpMigrationsDb);
  }
});
