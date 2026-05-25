import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function migrate() {
  try {
    console.log("Adding columns to leads table...");
    await db.execute("ALTER TABLE leads ADD COLUMN name TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN firm_name TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN needs_follow_up INTEGER DEFAULT 0");
    await db.execute("ALTER TABLE leads ADD COLUMN follow_up_note TEXT");
    await db.execute("ALTER TABLE leads ADD COLUMN last_updated DATETIME");
    console.log("Migration successful!");
  } catch (err) {
    if (err.message.includes("duplicate column name")) {
      console.log("Columns already exist, skipping.");
    } else {
      console.error(err);
    }
  }
}

migrate();
