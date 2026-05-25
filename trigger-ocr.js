import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const res = await db.execute("SELECT id, document_type, (SELECT token FROM secure_tokens WHERE secure_tokens.lead_id = document_requests.lead_id LIMIT 1) as token FROM document_requests LIMIT 1");
const doc = res.rows[0];
console.log(doc);

const resp = await fetch("https://lekho-edge.shahaaryan-milan-mst20.workers.dev/api/upload-complete/" + doc.token, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ documentType: doc.id })
});
console.log(await resp.text());
