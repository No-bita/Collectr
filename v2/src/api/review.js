import { getDbClient } from "../db/client.js";
import { StateConflict, requestProgress } from "../domain/states.js";
import { NotFoundError, closeRequest, transitionItem } from "../db/request-state.js";
import { getDocument } from "../db/documents.js";

/**
 * Staff review API (issue #10). Every route is firm-scoped: a request, item or
 * document outside the caller's firm is a 404, never a 403.
 */

const REVIEW_ACTIONS = Object.freeze({
  accept: "accepted",
  needs_replacement: "needs_replacement",
  waive: "waived",
});
const MAX_REASON_LENGTH = 1000;

function staffScope(c) {
  const firmId = c.get("firmId");
  const user = c.get("user");
  const userId = user?.id ?? user?.sub ?? user?.user_id;
  if (!firmId || !userId) return null;
  return { firmId, userId };
}

function publicDocument(row) {
  return {
    id: row.id,
    version: row.version,
    state: row.state,
    contentType: row.content_type,
    sizeBytes: row.size_bytes,
    uploadedAt: row.uploaded_at,
  };
}

function handleError(c, err, label) {
  if (err instanceof StateConflict || err instanceof NotFoundError) return c.json(err.toJSON(), err.status);
  console.error(`${label} failed:`, err);
  return c.json({ error: `${label} failed` }, 500);
}

/** GET /api/requests/:id - request, items with document versions, progress counts. */
export async function handleGetRequestReview(c) {
  c.header("Cache-Control", "no-store");
  const scope = staffScope(c);
  if (!scope) return c.json({ error: "Firm membership required." }, 403);
  try {
    const db = getDbClient(c.env);
    const requestId = c.req.param("id");
    const reqRes = await db.execute({
      sql: `SELECT id, client_id, contact_id, title, status, due_date, completed_at, created_at
            FROM requests WHERE id = ? AND firm_id = ? LIMIT 1`,
      args: [requestId, scope.firmId],
    });
    const request = reqRes.rows[0];
    if (!request) return c.json({ error: "Request not found." }, 404);
    const itemRes = await db.execute({
      sql: `SELECT id, title, description, required, status, allowed_types, max_bytes, position
            FROM request_items WHERE request_id = ? AND firm_id = ? ORDER BY position, id`,
      args: [requestId, scope.firmId],
    });
    const docRes = await db.execute({
      sql: `SELECT * FROM documents WHERE request_id = ? AND firm_id = ? ORDER BY item_id, version DESC`,
      args: [requestId, scope.firmId],
    });
    const byItem = new Map();
    for (const doc of docRes.rows) {
      if (!byItem.has(doc.item_id)) byItem.set(doc.item_id, []);
      byItem.get(doc.item_id).push(publicDocument(doc));
    }
    const items = itemRes.rows.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      required: item.required === 1 || item.required === true,
      status: item.status,
      allowedTypes: item.allowed_types,
      maxBytes: item.max_bytes,
      documents: byItem.get(item.id) ?? [],
    }));
    return c.json({
      request: {
        id: request.id,
        clientId: request.client_id ?? request.contact_id,
        title: request.title,
        status: request.status,
        dueDate: request.due_date,
        completedAt: request.completed_at,
        createdAt: request.created_at,
      },
      items,
      progress: requestProgress(itemRes.rows),
    });
  } catch (err) {
    return handleError(c, err, "Load request");
  }
}

/** POST /api/requests/:id/items/:itemId/review - accept, needs_replacement or waive. */
export async function handleReviewItem(c) {
  c.header("Cache-Control", "no-store");
  const scope = staffScope(c);
  if (!scope) return c.json({ error: "Firm membership required." }, 403);
  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return c.json({ error: "A JSON object body is required." }, 400);
  }
  const toStatus = Object.hasOwn(REVIEW_ACTIONS, body.action) ? REVIEW_ACTIONS[body.action] : null;
  if (!toStatus) {
    return c.json({ error: "action must be accept, needs_replacement or waive." }, 400);
  }
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (body.reason != null && typeof body.reason !== "string") {
    return c.json({ error: "reason must be a string." }, 400);
  }
  if (reason.length > MAX_REASON_LENGTH) {
    return c.json({ error: `reason must be at most ${MAX_REASON_LENGTH} characters.` }, 400);
  }
  if (body.action !== "accept" && !reason) {
    return c.json({ error: "reason is required for this action." }, 400);
  }

  try {
    const db = getDbClient(c.env);
    const requestId = c.req.param("id");
    const itemId = c.req.param("itemId");
    const reqRes = await db.execute({
      sql: "SELECT id, status FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [requestId, scope.firmId],
    });
    if (!reqRes.rows[0]) return c.json({ error: "Request not found." }, 404);
    if (["closed", "cancelled"].includes(reqRes.rows[0].status)) {
      return c.json({ error: `Items cannot be reviewed on a ${reqRes.rows[0].status} request.` }, 409);
    }

    // The document under review is the newest one still in play.
    const docRes = await db.execute({
      sql: `SELECT id FROM documents WHERE firm_id = ? AND request_id = ? AND item_id = ?
              AND state NOT IN ('rejected', 'superseded') ORDER BY version DESC LIMIT 1`,
      args: [scope.firmId, requestId, itemId],
    });
    const documentId = body.action === "waive" ? null : (docRes.rows[0]?.id ?? null);
    if (body.action !== "waive" && !documentId) {
      // Distinguish a missing item (404) from an item with nothing to review (409).
      const itemRes = await db.execute({
        sql: "SELECT status FROM request_items WHERE id = ? AND request_id = ? AND firm_id = ? LIMIT 1",
        args: [itemId, requestId, scope.firmId],
      });
      if (!itemRes.rows[0]) return c.json({ error: "Request item not found." }, 404);
      return c.json({ error: "No uploaded document to review.", currentStatus: itemRes.rows[0].status }, 409);
    }

    // transitionItem is the only writer of item status (compare-and-set).
    const result = await transitionItem(
      db, itemId, toStatus, { type: "staff", userId: scope.userId }, reason, { firmId: scope.firmId, requestId },
    );

    const eventId = "rev_" + crypto.randomUUID();
    const docState = body.action === "accept" ? "accepted" : "rejected";
    const statements = [];
    if (documentId) {
      statements.push({
        sql: "UPDATE documents SET state = ? WHERE id = ? AND firm_id = ?",
        args: [docState, documentId, scope.firmId],
      });
    }
    statements.push({
      sql: `INSERT INTO review_events (id, firm_id, request_id, item_id, document_id, actor_type, actor_id, action, reason, created_at)
            VALUES (?, ?, ?, ?, ?, 'staff', ?, ?, ?, ?)`,
      args: [eventId, scope.firmId, requestId, itemId, documentId, scope.userId, body.action, reason || null, new Date().toISOString()],
    });
    await db.batch(statements);

    return c.json({
      success: true,
      itemId,
      fromStatus: result.fromStatus,
      status: result.status,
      documentId,
      reviewEventId: eventId,
    });
  } catch (err) {
    return handleError(c, err, "Review item");
  }
}

/** GET /api/documents/:id/download - streams the stored object to firm staff. */
export async function handleDownloadDocument(c) {
  c.header("Cache-Control", "no-store");
  const scope = staffScope(c);
  if (!scope) return c.json({ error: "Firm membership required." }, 403);
  try {
    const db = getDbClient(c.env);
    const doc = await getDocument(db, { firmId: scope.firmId, documentId: c.req.param("id") });
    if (!doc) return c.json({ error: "Document not found." }, 404);
    const bucket = c.env.DOCUMENT_BUCKET;
    if (!bucket) return c.json({ error: "Document storage is not configured." }, 503);
    const object = await bucket.get(doc.object_key);
    if (!object) return c.json({ error: "Stored file not found." }, 404);
    const ext = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" }[doc.content_type] ?? "bin";
    const upload = await db.execute({
      sql: "SELECT original_filename FROM upload_sessions WHERE id = ? AND firm_id = ?",
      args: [doc.upload_session_id, scope.firmId],
    });
    const rawName = upload.rows[0]?.original_filename || `document-${doc.id}.${ext}`;
    // Header-safe filename: no quotes, slashes or control characters.
    const safeName = rawName.replace(/[^A-Za-z0-9._ -]/g, "_").slice(0, 120) || `document.${ext}`;
    return new Response(object.body, {
      status: 200,
      headers: {
        "Content-Type": doc.content_type,
        "Content-Disposition": `attachment; filename="${safeName}"`,
        "Content-Length": String(doc.size_bytes),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    return handleError(c, err, "Download document");
  }
}

/** POST /api/requests/:id/close - closes once every required item is accepted or waived. */
export async function handleCloseRequest(c) {
  c.header("Cache-Control", "no-store");
  const scope = staffScope(c);
  if (!scope) return c.json({ error: "Firm membership required." }, 403);
  try {
    const db = getDbClient(c.env);
    const result = await closeRequest(db, c.req.param("id"), { firmId: scope.firmId, userId: scope.userId });
    return c.json({ success: true, ...result });
  } catch (err) {
    return handleError(c, err, "Close request");
  }
}
