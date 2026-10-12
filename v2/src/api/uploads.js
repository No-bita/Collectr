import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getDbClient } from "../db/client.js";
import { resolveLink } from "../db/client_links.js";
import { createUploadSession, endUploadSession } from "../db/upload_sessions.js";

/**
 * POST /api/upload-url/:token (issue #6): validated upload-session initiator.
 *
 * Creates an upload_sessions row (state 'initiated') and a presigned PUT URL.
 * It never inserts a documents row and never changes item status; verified
 * receipt belongs to the completion handler (#7).
 */

export const SESSION_TTL_MS = 15 * 60 * 1000;
export const PRESIGN_TTL_SECONDS = 5 * 60;
export const MAX_SESSIONS_PER_LINK_PER_HOUR = 20;
const MAX_FILENAME_LENGTH = 255;
const MAX_KEY_LENGTH = 128;

const LINK_FAILURE_STATUS = Object.freeze({ not_found: 404, expired: 410, revoked: 410, request_closed: 409 });

// request_items.allowed_types stores short tokens ("pdf,jpg,png").
const TYPE_TOKEN_TO_MIME = Object.freeze({
  pdf: ["application/pdf"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  png: ["image/png"],
});

export function allowedMimeTypes(allowedTypes) {
  const mimes = new Set();
  for (const token of String(allowedTypes ?? "").split(",")) {
    for (const mime of TYPE_TOKEN_TO_MIME[token.trim().toLowerCase()] ?? []) mimes.add(mime);
  }
  return mimes;
}

/** Presign credentials (Worker secrets) and bucket name must all be present. */
export function storageConfig(env) {
  const bucketName = env?.R2_BUCKET_NAME;
  const ready = Boolean(env?.DOCUMENT_BUCKET && bucketName && env.CF_ACCOUNT_ID && env.R2_AK_id && env.R2_SAK);
  return ready ? { bucketName } : null;
}

/** Default presigner: S3-compatible R2 PUT bound to the declared type and length. */
export async function presignPut(env, { bucketName, key, contentType, size }) {
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_AK_id, secretAccessKey: env.R2_SAK },
  });
  const command = new PutObjectCommand({ Bucket: bucketName, Key: key, ContentType: contentType, ContentLength: size });
  const uploadUrl = await getSignedUrl(s3, command, {
    expiresIn: PRESIGN_TTL_SECONDS,
    signableHeaders: new Set(["content-type", "content-length"]),
  });
  return { uploadUrl, headers: { "Content-Type": contentType, "Content-Length": String(size) } };
}

function fail(c, status, code) {
  return c.json({ error: code }, status);
}

function cleanFilename(value) {
  if (typeof value !== "string") return null;
  const name = value.split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return name && name.length <= MAX_FILENAME_LENGTH ? name : null;
}

export function makeUploadUrlHandler({ presign = presignPut, now = () => new Date() } = {}) {
  return async function handleUploadUrlRequest(c) {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    try {
      let body;
      try { body = await c.req.json(); } catch { return fail(c, 400, "invalid_request"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return fail(c, 400, "invalid_request");
      const { itemId, contentType, size } = body;
      const filename = cleanFilename(body.filename);
      const key = body.idempotencyKey ?? crypto.randomUUID();
      if (typeof itemId !== "string" || !itemId || typeof contentType !== "string" || !contentType || !filename
        || typeof key !== "string" || !key || key.length > MAX_KEY_LENGTH) {
        return fail(c, 400, "invalid_request");
      }

      const db = getDbClient(c.env);
      const current = now();
      const resolved = await resolveLink(db, c.req.param("token"), { now: current });
      if (!resolved.ok) return fail(c, LINK_FAILURE_STATUS[resolved.reason] ?? 404, resolved.reason);
      const { link, request } = resolved;

      const itemRes = await db.execute({
        sql: "SELECT id, status, allowed_types, max_bytes FROM request_items WHERE id = ? AND request_id = ? AND firm_id = ?",
        args: [itemId, request.id, link.firm_id],
      });
      const item = itemRes.rows[0];
      if (!item) return fail(c, 404, "item_not_found");
      if (item.status === "accepted" || item.status === "waived") return fail(c, 409, "item_closed");
      if (!allowedMimeTypes(item.allowed_types).has(contentType)) return fail(c, 415, "type_not_allowed");
      if (!Number.isSafeInteger(size) || size <= 0) return fail(c, 400, "invalid_size");
      if (size > item.max_bytes) return fail(c, 413, "file_too_large");

      const storage = storageConfig(c.env);
      if (!storage) return fail(c, 503, "storage_not_configured");

      // Retry with the same key returns the existing session and does not count against the limit.
      const existing = await db.execute({
        sql: "SELECT id FROM upload_sessions WHERE link_id = ? AND idempotency_key = ?",
        args: [link.id, key],
      });
      if (!existing.rows[0]) {
        const recent = await db.execute({
          sql: "SELECT COUNT(*) AS n FROM upload_sessions WHERE link_id = ? AND created_at > datetime('now', '-1 hour')",
          args: [link.id],
        });
        if (Number(recent.rows[0]?.n ?? 0) >= MAX_SESSIONS_PER_LINK_PER_HOUR) return fail(c, 429, "rate_limited");
      }

      const created = await createUploadSession(db, {
        firmId: link.firm_id, requestId: request.id, itemId, linkId: link.id,
        declaredContentType: contentType, declaredSize: size, originalFilename: filename,
        expiresAt: new Date(current.getTime() + SESSION_TTL_MS).toISOString(), idempotencyKey: key,
      });
      if (!created.ok) {
        return fail(c, created.reason === "idempotency_conflict" ? 409 : 404, created.reason);
      }
      const session = created.session;
      if (session.state !== "initiated") return fail(c, 409, "session_not_active");
      if (Date.parse(session.expires_at) <= current.getTime()) {
        await endUploadSession(db, { firmId: link.firm_id, sessionId: session.id, state: "expired" });
        return fail(c, 409, "session_expired");
      }

      let signed;
      try {
        signed = await presign(c.env, { bucketName: storage.bucketName, key: session.object_key, contentType, size });
      } catch {
        // No error detail: it can carry credentials or the signed URL.
        await endUploadSession(db, { firmId: link.firm_id, sessionId: session.id, state: "failed" });
        return fail(c, 500, "upload_url_unavailable");
      }
      return c.json({
        uploadSessionId: session.id,
        uploadUrl: signed.uploadUrl,
        headers: signed.headers,
        expiresAt: session.expires_at,
      });
    } catch {
      // Do not log exceptions: token-bearing request URLs may be present in them.
      return fail(c, 500, "upload_unavailable");
    }
  };
}

export const handleUploadUrlRequest = makeUploadUrlHandler();
