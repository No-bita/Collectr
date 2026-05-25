/**
 * Isolate Drive vs WhatsApp media issues.
 *
 *   node scripts/isolate-upload.mjs drive
 *   node scripts/isolate-upload.mjs media <MEDIA_ID>
 *
 * Uses the same .env as the app (run from repo root).
 */

import "dotenv/config";
import fetch from "node-fetch";
import { Readable } from "node:stream";
import { google } from "googleapis";

function resolveDriveFolderId() {
  let raw = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (raw == null || raw === "") return "";
  raw = String(raw).trim().replace(/^["']|["']$/g, "");
  const fromUrl = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  return raw;
}

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

async function testDrive() {
  const KEY_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE?.trim() || "credentials.json";
  const folderId = resolveDriveFolderId();
  if (!folderId) {
    console.error("FAIL: GOOGLE_DRIVE_FOLDER_ID is not set or empty.");
    process.exit(1);
  }

  const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
  const drive = google.drive({ version: "v3", auth });

  const name = `lekho-drive-test-${Date.now()}.txt`;
  const buffer = Buffer.from("lekho drive connectivity test\n", "utf8");

  try {
    const { data } = await drive.files.create({
      requestBody: {
        name,
        parents: [folderId],
      },
      media: {
        mimeType: "text/plain",
        body: Readable.from(buffer),
      },
      fields: "id, parents, name",
      supportsAllDrives: true,
    });

    const parents = data.parents || [];
    const inFolder = parents.includes(folderId);

    console.log("=== DRIVE TEST: OK ===");
    console.log("fileId:     ", data.id);
    console.log("name:       ", data.name);
    console.log("parents:    ", parents.join(", ") || "(none)");
    console.log("expected:   ", folderId);
    console.log("in folder:  ", inFolder ? "yes" : "NO — check folder ID + share with service account");

    await drive.permissions.create({
      fileId: data.id,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
    });
    console.log("link:       ", `https://drive.google.com/file/d/${data.id}/view`);
    console.log("\nYou can delete this file in Drive when finished.");
  } catch (err) {
    console.error("=== DRIVE TEST: FAILED ===");
    console.error(err.message || err);
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
    process.exit(1);
  }
}

async function testWhatsAppMedia(mediaId) {
  const TOKEN = requireEnv("TOKEN");
  const v = process.env.WHATSAPP_GRAPH_VERSION?.trim() || "v18.0";

  const metaUrl = `https://graph.facebook.com/${v}/${encodeURIComponent(mediaId)}`;
  const metaRes = await fetch(metaUrl, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const meta = await metaRes.json().catch(() => ({}));

  if (!metaRes.ok) {
    console.error("=== WHATSAPP MEDIA TEST: META FAILED ===");
    console.error("HTTP", metaRes.status);
    console.error(JSON.stringify(meta, null, 2));
    console.error("\nIf this fails: token, phone number / app permissions, or media id expired/wrong.");
    process.exit(1);
  }

  console.log("=== WHATSAPP MEDIA: META OK ===");
  console.log("mime_type: ", meta.mime_type);
  console.log("file_size: ", meta.file_size);
  console.log("url:       ", meta.url ? "(present)" : "(missing)");

  if (!meta.url) {
    console.error("\nNo download URL in meta response — cannot test binary download.");
    process.exit(1);
  }

  const binRes = await fetch(meta.url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  const buf = Buffer.from(await binRes.arrayBuffer());

  if (!binRes.ok) {
    console.error("=== WHATSAPP MEDIA TEST: DOWNLOAD FAILED ===");
    console.error("HTTP", binRes.status);
    console.error("body head:", buf.toString("utf8").slice(0, 200));
    process.exit(1);
  }

  console.log("=== WHATSAPP MEDIA: DOWNLOAD OK ===");
  console.log("bytes downloaded:", buf.length);
  console.log("\nIf drive test fails but this passes → problem is Google Drive (folder, scopes, SA share).");
  console.log("If this fails → problem is WhatsApp / Graph / token / media id.");
}

const mode = process.argv[2];
const mediaId = process.argv[3];

if (mode === "drive") {
  await testDrive();
} else if (mode === "media" && mediaId) {
  await testWhatsAppMedia(mediaId);
} else {
  console.log(`
Usage (from project root):

  node scripts/isolate-upload.mjs drive
      Uploads a tiny .txt file into GOOGLE_DRIVE_FOLDER_ID using the same
      credentials as the app.

  node scripts/isolate-upload.mjs media <MEDIA_ID>
      Calls Graph API for that media id, then downloads bytes (no Drive).
      Use an id from server logs after someone sends an image/document
      (WhatsApp media URLs expire; use a fresh id).

Interpretation:
  drive OK, media fails  → fix TOKEN / Meta / media id
  media OK, drive fails  → fix folder id, share folder with service account, Drive API
  both OK                → bug is likely in app wiring (check logs around tryTwice)
`);
  process.exit(1);
}
