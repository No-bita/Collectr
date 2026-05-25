import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});

async function run() {
  const tokens = await db.execute("SELECT * FROM secure_tokens WHERE status = 'active' LIMIT 1");
  if(tokens.rows.length === 0) { console.log("no tokens"); return; }
  const token = tokens.rows[0].token;
  const docs = await db.execute({
    sql: "SELECT id FROM document_requests WHERE lead_id = ?",
    args: [tokens.rows[0].lead_id]
  });
  if(docs.rows.length === 0) { console.log("no docs"); return; }
  const docId = docs.rows[0].id;
  
  // mock request
  const req = {
    param: () => token,
    json: async () => ({ documentId: docId, contentType: "application/pdf" })
  };
  const env = process.env;
  
  try {
    const fetchRes = await fetch(`http://127.0.0.1:8787/api/upload-url/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: docId, contentType: "application/pdf" })
    });
    console.log("Status:", fetchRes.status);
    console.log("Body:", await fetchRes.text());
  } catch(e) { console.error(e); }
}
run();
