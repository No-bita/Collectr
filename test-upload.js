import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const tokens = await db.execute("SELECT * FROM secure_tokens WHERE status = 'active' LIMIT 1");
const token = tokens.rows[0].token;
const docs = await db.execute({
  sql: "SELECT id FROM document_requests WHERE lead_id = ?",
  args: [tokens.rows[0].lead_id]
});
const docId = docs.rows[0].id;
console.log(token, docId);
