import { google } from "googleapis";
import { config } from "../config/env.js";

const auth = new google.auth.GoogleAuth({
  keyFile: config.GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

export const sheets = google.sheets({ version: "v4", auth });
export const drive = google.drive({ version: "v3", auth });
