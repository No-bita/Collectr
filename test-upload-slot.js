import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
async function run() {
  const tokens = await db.execute("SELECT * FROM secure_tokens WHERE status = 'active' LIMIT 1");
  const token = tokens.rows[0].token;
  const docs = await db.execute({
    sql: "SELECT id FROM document_requests WHERE lead_id = ?",
    args: [tokens.rows[0].lead_id]
  });
  const docId = docs.rows[0].id;
  console.log("docId:", docId, "token:", token);
  
  const req = await fetch(`http://127.0.0.1:8787/api/upload-url/${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentId: docId, contentType: 'application/pdf' })
  });
  console.log("Status:", req.status);
  console.log("Body:", await req.text());
}
run();
