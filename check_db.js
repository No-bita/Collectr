import { createClient } from "@libsql/client";
import dotenv from "dotenv";
dotenv.config({ path: ".dev.vars" });

const db = createClient({
  url: process.env.DATABASE_URL,
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

async function run() {
  const res = await db.execute("PRAGMA table_info(document_requests)");
  console.log(res.rows);
}
run();
