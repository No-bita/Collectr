import fetch from "node-fetch";
import { Readable } from "node:stream";
import { drive } from "../infrastructure/google-clients.js";
import { config } from "../config/env.js";
import { digitsOnly } from "../modules/shared/phone.js";

function extensionFromFilenameAndMime(filename, mimeType) {
  if (filename && typeof filename === "string") {
    const m = filename.match(/(\.[a-zA-Z0-9]{1,8})$/);
    if (m) return m[1].toLowerCase();
  }
  const mime = String(mimeType || "").split(";")[0].trim().toLowerCase();
  const map = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "application/pdf": ".pdf",
  };
  return map[mime] || ".bin";
}

export function resolveDriveFolderId() {
  let raw = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (raw == null || raw === "") return "";
  raw = String(raw).trim().replace(/^["']|["']$/g, "");
  const fromUrl = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (fromUrl) return fromUrl[1];
  return raw;
}

async function fetchWhatsAppMediaMeta(mediaId) {
  const res = await fetch(
    `https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(mediaId)}`,
    {
      headers: { Authorization: `Bearer ${config.TOKEN}` },
    },
  );
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`WhatsApp media meta ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

async function downloadWhatsAppMedia(mediaUrl) {
  const res = await fetch(mediaUrl, { headers: { Authorization: `Bearer ${config.TOKEN}` } });
  if (!res.ok) throw new Error(`WhatsApp media download ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function uploadBufferToDrivePublic(buffer, fileName, mimeType) {
  const folderId = resolveDriveFolderId();
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID is not set or empty");

  const { data: created } = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType: mimeType || "application/octet-stream",
      body: Readable.from(buffer),
    },
    fields: "id, parents, name, driveId",
    supportsAllDrives: true,
  });

  await drive.permissions.create({
    fileId: created.id,
    requestBody: {
      type: "anyone",
      role: "reader",
    },
    supportsAllDrives: true,
  });

  return `https://drive.google.com/file/d/${created.id}/view`;
}

export async function processMediaToDriveWithPayload(mediaId, from, docId, message) {
  const meta = await fetchWhatsAppMediaMeta(mediaId);
  const mediaUrl = meta.url;
  if (!mediaUrl) throw new Error("No media URL from Graph API");

  const mimeFromMeta = meta.mime_type;
  const mimeFromMsg = message.document?.mime_type || message.image?.mime_type || mimeFromMeta;
  const mimeType = mimeFromMsg || "application/octet-stream";

  const buffer = await downloadWhatsAppMedia(mediaUrl);
  const ext = extensionFromFilenameAndMime(message.document?.filename, mimeType);
  const fileName = `${digitsOnly(from)}_${docId}_${Date.now()}${ext}`;

  const driveLink = await uploadBufferToDrivePublic(buffer, fileName, mimeType);
  return {
    driveLink,
    fileName,
    mimeType,
    buffer,
  };
}

export async function processMediaToDrive(mediaId, from, docId, message) {
  const payload = await processMediaToDriveWithPayload(mediaId, from, docId, message);
  return payload.driveLink;
}

export async function tryTwice(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`Drive/media attempt ${attempt} failed:`, err.message || err);
    }
  }
  return null;
}
