import { getDbClient } from "../db/client.js";
import { resolveLink } from "../db/client_links.js";
import { endUploadSession } from "../db/upload_sessions.js";
import { transitionItem } from "../db/request-state.js";
import { StateConflict } from "../domain/states.js";

/**
 * POST /api/upload-complete/:token (issue #7): verified receipt.
 *
 * Body: { uploadSessionId }. Checks the object exists in R2 with the declared
 * size and type, then records the document and moves the item to "received".
 * "Received" means stored, not reviewed: nothing here claims verification.
 */

const LINK_FAILURE_STATUS = Object.freeze({ not_found: 404, expired: 410, revoked: 410, request_closed: 409 });
const RECEIVED_MESSAGE = "File received. Your accountant will review it.";

function fail(c, status, code) {
  return c.json({ error: code }, status);
}

/** Move the item to received if it is still waiting for a file. Later uploads to an item already in review leave it alone. */
async function ensureItemReceived(db, { firmId, requestId, itemId }) {
  try {
    await transitionItem(db, itemId, "received", { type: "client_link" }, null, { firmId, requestId });
  } catch (err) {
    if (!(err instanceof StateConflict)) throw err;
  }
  const res = await db.execute({
    sql: "SELECT status FROM request_items WHERE id = ? AND request_id = ? AND firm_id = ?",
    args: [itemId, requestId, firmId],
  });
  return res.rows[0]?.status ?? null;
}

async function respondReceived(c, db, { firmId, requestId, itemId, documentId }) {
  const itemStatus = await ensureItemReceived(db, { firmId, requestId, itemId });
  const counts = await db.execute({
    sql: `SELECT COUNT(*) AS n FROM documents
          WHERE request_id = ? AND firm_id = ? AND item_id = ? AND state NOT IN ('rejected', 'superseded')`,
    args: [requestId, firmId, itemId],
  });
  return c.json({
    documentId, itemId, itemStatus,
    uploadCount: Number(counts.rows[0]?.n ?? 0),
    message: RECEIVED_MESSAGE,
  });
}

export function makeUploadCompleteHandler({ now = () => new Date() } = {}) {
  return async function handleUploadComplete(c) {
    c.header("Cache-Control", "no-store");
    c.header("Referrer-Policy", "no-referrer");
    try {
      let body;
      try { body = await c.req.json(); } catch { return fail(c, 400, "invalid_request"); }
      if (!body || typeof body !== "object" || Array.isArray(body)) return fail(c, 400, "invalid_request");
      const sessionId = body.uploadSessionId;
      if (typeof sessionId !== "string" || !sessionId || sessionId.length > 128) return fail(c, 400, "invalid_request");

      const db = getDbClient(c.env);
      const current = now();
      const resolved = await resolveLink(db, c.req.param("token"), { now: current });
      if (!resolved.ok) return fail(c, LINK_FAILURE_STATUS[resolved.reason] ?? 404, resolved.reason);
      const { link, request } = resolved;
      const firmId = link.firm_id;

      // The session must belong to this link and request; anything else looks like not found.
      const found = await db.execute({
        sql: "SELECT * FROM upload_sessions WHERE id = ? AND link_id = ? AND request_id = ? AND firm_id = ?",
        args: [sessionId, link.id, request.id, firmId],
      });
      const session = found.rows[0];
      if (!session) return fail(c, 404, "session_not_found");

      if (session.state === "completed") {
        const doc = (await db.execute({
          sql: "SELECT id FROM documents WHERE upload_session_id = ? AND firm_id = ?",
          args: [session.id, firmId],
        })).rows[0];
        if (!doc) return fail(c, 409, "session_not_active");
        return respondReceived(c, db, { firmId, requestId: request.id, itemId: session.item_id, documentId: doc.id });
      }
      if (session.state === "failed") return fail(c, 409, "session_failed");
      if (session.state === "expired" || Date.parse(session.expires_at) <= current.getTime()) {
        await endUploadSession(db, { firmId, sessionId: session.id, state: "expired" });
        return fail(c, 409, "session_expired");
      }

      const item = (await db.execute({
        sql: "SELECT status FROM request_items WHERE id = ? AND request_id = ? AND firm_id = ?",
        args: [session.item_id, request.id, firmId],
      })).rows[0];
      if (!item) return fail(c, 404, "item_not_found");
      if (item.status === "accepted" || item.status === "waived") return fail(c, 409, "item_closed");

      const bucket = c.env?.DOCUMENT_BUCKET;
      if (!bucket || typeof bucket.head !== "function") return fail(c, 503, "storage_not_configured");
      let head;
      try {
        head = await bucket.head(session.object_key);
      } catch {
        return fail(c, 502, "storage_unavailable");
      }
      // Missing object: leave the session initiated so the client can retry the PUT.
      if (!head) return fail(c, 409, "object_missing");

      const etag = String(head.etag ?? head.httpEtag ?? "");
      if (!etag) return fail(c, 502, "storage_unavailable");
      const storedType = head.httpMetadata?.contentType;
      if (Number(head.size) !== Number(session.declared_size) || storedType !== session.declared_content_type) {
        await endUploadSession(db, { firmId, sessionId: session.id, state: "failed" });
        try { await bucket.delete(session.object_key); } catch { /* the session is already failed */ }
        return fail(c, 422, "object_mismatch");
      }

      const documentId = crypto.randomUUID();
      const completedAt = current.toISOString();
      await db.batch([
        {
          // Compare-and-set: only one caller moves the session to completed.
          sql: `UPDATE upload_sessions SET state = 'completed', completed_at = ?
                WHERE id = ? AND firm_id = ? AND state = 'initiated'`,
          args: [completedAt, session.id, firmId],
        },
        {
          sql: `INSERT INTO documents (id, firm_id, request_id, item_id, upload_session_id, object_key,
                                       content_type, size_bytes, etag, version, state)
                SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?,
                       COALESCE((SELECT MAX(version) FROM documents WHERE item_id = ?), 0) + 1, 'received'
                WHERE changes() > 0`,
          args: [documentId, firmId, request.id, session.item_id, session.id, session.object_key,
            session.declared_content_type, Number(head.size), etag, session.item_id],
        },
        {
          sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
                SELECT ?, ?, ?, ?, 'document_received', 'Document received', ?, ?, datetime('now'), ?
                WHERE changes() > 0`,
          args: ["act_" + crypto.randomUUID(), request.user_id, request.contact_id, request.id,
            session.original_filename,
            JSON.stringify({ itemId: session.item_id, documentId, uploadSessionId: session.id, actor: "client_link" }),
            firmId],
        },
        {
          // A replacement upload retires earlier rejected files for the item.
          sql: `UPDATE documents SET state = 'superseded'
                WHERE firm_id = ? AND item_id = ? AND state = 'rejected' AND id != ?
                  AND EXISTS (SELECT 1 FROM documents WHERE id = ?)`,
          args: [firmId, session.item_id, documentId, documentId],
        },
      ]);

      // A concurrent confirm may have won; either way the session now has exactly one document.
      const doc = (await db.execute({
        sql: "SELECT id FROM documents WHERE upload_session_id = ? AND firm_id = ?",
        args: [session.id, firmId],
      })).rows[0];
      if (!doc) return fail(c, 409, "session_not_active");
      return respondReceived(c, db, { firmId, requestId: request.id, itemId: session.item_id, documentId: doc.id });
    } catch {
      // Do not log exceptions: token-bearing request URLs may be present in them.
      return fail(c, 500, "upload_complete_unavailable");
    }
  };
}

export const handleUploadComplete = makeUploadCompleteHandler();
