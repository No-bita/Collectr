import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function run() {
  try {
    console.log("Creating system_failures table...");
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_failures (
        id TEXT PRIMARY KEY,
        error_type TEXT NOT NULL, -- 'whatsapp_delivery', 'ocr_processing', 'api_error'
        lead_id TEXT, -- optional reference to lead
        details TEXT, -- JSON or string describing the failure
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Table created successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

run();
