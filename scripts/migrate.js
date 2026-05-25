import "dotenv/config";
import fs from "node:fs/promises";
import { createClient } from "@libsql/client";

async function main() {
  const url = process.env.DATABASE_URL;
  const authToken = process.env.DATABASE_AUTH_TOKEN;

  if (!url || !authToken) {
    console.error("Missing Turso database credentials in .env");
    process.exit(1);
  }

  const db = createClient({ url, authToken });
  console.log("Connected to Turso DB.");

  try {
    const schema = await fs.readFile("./src/db/schema.sql", "utf-8");
    // Split schema by semicolon to get individual queries
    const queries = schema
      .split(";")
      .map(q => q.trim())
      .filter(q => q.length > 0);

    for (const query of queries) {
      console.log(`Executing: ${query.slice(0, 50)}...`);
      await db.execute(query);
    }
    
    console.log("Schema migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    db.close();
  }
}

main();
