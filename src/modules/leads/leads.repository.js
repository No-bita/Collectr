import { sheets } from "../../infrastructure/google-clients.js";
import { config } from "../../config/env.js";
import { COL, SHEET_NAME, SHEET_ROW_RANGE } from "../../../sheet-layout.js";
import { samePhone } from "../shared/phone.js";

export function padRowToSheet(row) {
  const out = [...(row || [])];
  while (out.length < 9) out.push("");
  return out.slice(0, 9);
}

export async function getAllUsers() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:${SHEET_ROW_RANGE}`,
  });
  return res.data.values || [];
}

export async function getUser(phone) {
  const rows = await getAllUsers();
  const index = rows.findIndex(
    (row) => row[COL.phone] != null && String(row[COL.phone]).trim() !== "" && samePhone(row[COL.phone], phone),
  );
  if (index === -1) return null;
  return { row: rows[index], index };
}

export async function appendUserRow(newRow) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${SHEET_NAME}!A2:${SHEET_ROW_RANGE}`,
    valueInputOption: "RAW",
    requestBody: { values: [newRow] },
  });
}

export async function updateUserRow(rowIndex, updatedRow) {
  const row = padRowToSheet(updatedRow);
  await sheets.spreadsheets.values.update({
    spreadsheetId: config.SPREADSHEET_ID,
    range: `${SHEET_NAME}!A${rowIndex + 2}:${SHEET_ROW_RANGE}${rowIndex + 2}`,
    valueInputOption: "RAW",
    requestBody: { values: [row] },
  });
}

export function sheetsUserMessage(err, fallback) {
  const status = err?.response?.status;
  const msg = String(err?.response?.data?.error?.message || err?.message || "");
  if (status === 403 || /permission|forbidden/i.test(msg)) {
    return "Could not write to the spreadsheet. Share it with the service account from your Google key file (Editor).";
  }
  if (status === 404 || /not found|unable to parse/i.test(msg)) {
    return "Spreadsheet or tab not found. Check SPREADSHEET_ID and that the Sheet1 tab exists (see sheet-layout.js).";
  }
  if (/invalid.*range|does not exist/i.test(msg)) {
    return "Sheet range error. Run npm run sheet:headers or fix SHEET_NAME / columns in sheet-layout.js.";
  }
  return fallback;
}
