import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const res = await db.execute("SELECT document_type, ocr_payload FROM document_requests WHERE ocr_payload IS NOT NULL");
console.log(res.rows);
