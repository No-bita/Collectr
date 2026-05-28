import fetch from "node-fetch";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
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

async function fetchWhatsAppMediaMeta(mediaId) {
  const res = await fetch(
    `https://graph.facebook.com/${config.WHATSAPP_GRAPH_VERSION}/${encodeURIComponent(mediaId)}`,
    {
      headers: { Authorization: `Bearer ${config.TOKEN}` },
    }
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

async function uploadBufferToR2(buffer, fileKey, mimeType) {
  const S3 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_AK_id,
      secretAccessKey: process.env.R2_SAK,
    },
  });

  const command = new PutObjectCommand({
    Bucket: "lekho-documents",
    Key: fileKey,
    ContentType: mimeType || "application/octet-stream",
    Body: buffer,
  });

  await S3.send(command);
  // Return the dashboard-compatible view URL
  return `/api/documents/${fileKey}`;
}

export async function processMediaToR2WithPayload(mediaId, from, docId, message, clientName) {
  const meta = await fetchWhatsAppMediaMeta(mediaId);
  const mediaUrl = meta.url;
  if (!mediaUrl) throw new Error("No media URL from Graph API");

  const mimeFromMeta = meta.mime_type;
  const mimeFromMsg = message.document?.mime_type || message.image?.mime_type || mimeFromMeta;
  const mimeType = mimeFromMsg || "application/octet-stream";

  const buffer = await downloadWhatsAppMedia(mediaUrl);
  const ext = extensionFromFilenameAndMime(message.document?.filename, mimeType);
  const cName = (clientName || "Client").replace(/[^a-zA-Z0-9]/g, "_");
  const fileKey = `${digitsOnly(from)}/${cName}_${docId}${ext}`;

  const driveLink = await uploadBufferToR2(buffer, fileKey, mimeType);
  return {
    driveLink,
    fileName: fileKey,
    fileKey,
    mimeType,
    buffer,
  };
}

export async function tryTwice(fn) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await fn();
    } catch (err) {
      console.error(`Media attempt ${attempt} failed:`, err.message || err);
    }
  }
  return null;
}
