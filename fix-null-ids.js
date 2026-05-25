import { createClient } from "@libsql/client";
import dotenv from "dotenv";
import crypto from "crypto";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
async function run() {
  const docs = await db.execute("SELECT rowid, lead_id FROM document_requests WHERE id IS NULL");
  for(const doc of docs.rows) {
    const newId = crypto.randomUUID();
    await db.execute({
      sql: "UPDATE document_requests SET id = ? WHERE rowid = ?",
      args: [newId, doc.rowid]
    });
  }
  console.log("Fixed", docs.rows.length, "null IDs.");
}
run();
