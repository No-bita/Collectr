import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const res = await db.execute("PRAGMA table_info(leads)");
console.log(res.rows);
const tokens = await db.execute("SELECT * FROM secure_tokens LIMIT 1");
console.log(tokens.rows);
