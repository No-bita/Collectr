/**
 * Writes row 1 header labels to the connected Google Sheet (columns A–N).
 *
 *   npm run sheet:headers
 *
 * Requires .env with SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_KEY_FILE (same as the app).
 * Does not modify data rows (row 2+).
 */

import "dotenv/config";
import { google } from "googleapis";
import {
  SHEET_HEADER_ROW,
  SHEET_NAME,
  SHEET_ROW_RANGE,
} from "../sheet-layout.js";

function requireEnv(name) {
  let v = process.env[name];
  if (v === undefined || v === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  v = v.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}

const expectedCols = SHEET_ROW_RANGE.charCodeAt(0) - "A".charCodeAt(0) + 1;
if (SHEET_HEADER_ROW.length !== expectedCols) {
  console.error(
    `SHEET_HEADER_ROW length ${SHEET_HEADER_ROW.length} must match columns A–${SHEET_ROW_RANGE} (${expectedCols}).`,
  );
  process.exit(1);
}

const SPREADSHEET_ID = requireEnv("SPREADSHEET_ID");
const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() || "credentials.json";

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_FILE,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const range = `${SHEET_NAME}!A1:${SHEET_ROW_RANGE}1`;

await sheets.spreadsheets.values.update({
  spreadsheetId: SPREADSHEET_ID,
  range,
  valueInputOption: "RAW",
  requestBody: {
    values: [SHEET_HEADER_ROW],
  },
});

console.log("OK — updated header row:", range);
console.log(SHEET_HEADER_ROW.join(" | "));
