import { createClient } from "@libsql/client/web";

export function getDbClient(env) {
  return createClient({
    url: env.DATABASE_URL,
    authToken: env.DATABASE_AUTH_TOKEN,
  });
}
