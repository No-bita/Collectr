/** Upload intent only. Document creation belongs to the R2-verified completion handler (#7). */
export function buildObjectKey({ firmId, requestId, sessionId }) {
  for (const id of [firmId, requestId, sessionId]) {
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]+$/.test(id)) {
      throw new TypeError("Storage identifiers must be nonempty path-safe IDs");
    }
  }
  return `firms/${firmId}/requests/${requestId}/${sessionId}`;
}

export async function getUploadSession(db, { firmId, sessionId }) {
  const result = await db.execute({
    sql: "SELECT * FROM upload_sessions WHERE id = ? AND firm_id = ?",
    args: [sessionId, firmId],
  });
  return result.rows[0] ?? null;
}

/** Atomic scoped INSERT; retries on one link reuse the same intent, never a document. */
export async function createUploadSession(db, {
  firmId, requestId, itemId, linkId, declaredContentType, declaredSize,
  originalFilename, expiresAt, idempotencyKey,
}) {
  if (!Number.isSafeInteger(declaredSize) || declaredSize <= 0) {
    throw new TypeError("declaredSize must be a positive safe integer");
  }
  if (![declaredContentType, originalFilename, idempotencyKey].every(v => typeof v === "string" && v.length > 0)) {
    throw new TypeError("Content type, filename and idempotency key are required");
  }
  if (typeof expiresAt !== "string" || !Number.isFinite(Date.parse(expiresAt))) {
    throw new TypeError("expiresAt must be a valid timestamp");
  }
  const id = crypto.randomUUID();
  const objectKey = buildObjectKey({ firmId, requestId, sessionId: id });
  await db.execute({
    sql: `INSERT INTO upload_sessions
      (id, firm_id, request_id, item_id, link_id, object_key, declared_content_type,
       declared_size, original_filename, expires_at, idempotency_key)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      FROM request_items i JOIN client_links l ON l.request_id = i.request_id AND l.firm_id = i.firm_id
      WHERE i.id = ? AND i.request_id = ? AND i.firm_id = ? AND l.id = ?
      ON CONFLICT(link_id, idempotency_key) DO NOTHING`,
    args: [id, firmId, requestId, itemId, linkId, objectKey, declaredContentType,
      declaredSize, originalFilename, new Date(expiresAt).toISOString(), idempotencyKey,
      itemId, requestId, firmId, linkId],
  });
  const result = await db.execute({
    sql: "SELECT * FROM upload_sessions WHERE link_id = ? AND idempotency_key = ? AND firm_id = ? AND request_id = ? AND item_id = ?",
    args: [linkId, idempotencyKey, firmId, requestId, itemId],
  });
  const session = result.rows[0];
  if (!session) return { ok: false, reason: "scope_not_found" };
  if (session.declared_content_type !== declaredContentType || session.declared_size !== declaredSize || session.original_filename !== originalFilename) {
    return { ok: false, reason: "idempotency_conflict" };
  }
  return { ok: true, session, reused: session.id !== id };
}

/** Failure/expiry only; cannot mark complete or alter an already terminal session. */
export async function endUploadSession(db, { firmId, sessionId, state }) {
  if (!["expired", "failed"].includes(state)) throw new TypeError("Only expired or failed is allowed here");
  const result = await db.execute({
    sql: "UPDATE upload_sessions SET state = ? WHERE id = ? AND firm_id = ? AND state = 'initiated'",
    args: [state, sessionId, firmId],
  });
  return { changed: (result.changes ?? 0) > 0 };
}
