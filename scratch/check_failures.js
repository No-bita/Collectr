import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });
const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN
});
const res = await db.execute("SELECT * FROM system_failures ORDER BY created_at DESC LIMIT 5");
console.log(JSON.stringify(res.rows, null, 2));

const leads = await db.execute("SELECT * FROM leads ORDER BY created_at DESC LIMIT 2");
console.log("RECENT LEADS:");
console.log(JSON.stringify(leads.rows, null, 2));

process.exit(0);
