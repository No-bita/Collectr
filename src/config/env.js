export function requireEnv(name) {
  let v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!v) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const config = {
  VERIFY_TOKEN: requireEnv("VERIFY_TOKEN"),
  TOKEN: requireEnv("TOKEN"),
  PHONE_NUMBER_ID: requireEnv("PHONE_NUMBER_ID"),
  SPREADSHEET_ID: requireEnv("SPREADSHEET_ID"),
  GOOGLE_SERVICE_ACCOUNT_KEY_FILE:
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() || "credentials.json",
  PORT: parseInt(process.env.PORT || "3000", 10),
  WHATSAPP_GRAPH_VERSION: process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v18.0",
  FOLLOW_UP_IDLE_HOURS: Math.max(
    0.01,
    parseFloat(String(process.env.FOLLOW_UP_IDLE_HOURS || "2").trim()) || 2,
  ),
  WHATSAPP_FOLLOW_UP_INIT_TEMPLATE:
    process.env.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE?.trim() || "hello_world",
  WHATSAPP_FOLLOW_UP_INIT_TEMPLATE_LANG:
    process.env.WHATSAPP_FOLLOW_UP_INIT_TEMPLATE_LANG?.trim() || "en_US",
};

export const FOLLOW_UP_IDLE_MS = config.FOLLOW_UP_IDLE_HOURS * 3600000;
