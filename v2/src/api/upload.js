import { getDbClient } from "../db/client.js";

// POST /api/upload-url/:token moved to uploads.js (issue #6).
// handleDirectUpload is reworked or removed by issue #9.

export async function handleDirectUpload(c) {
  const token = c.req.param("token");
  const formData = await c.req.parseBody();
  const file = formData.file;
  const requiredDocId = formData.requiredDocId;

  if (!token || !requiredDocId || !file) {
    return c.json({ error: "Missing required fields for direct upload" }, 400);
  }

  const db = getDbClient(c.env);
  const tokenRes = await db.execute({
    sql: "SELECT case_id, status FROM secure_tokens WHERE token = ? AND expires_at > CURRENT_TIMESTAMP",
    args: [token],
  });

  if (tokenRes.rows.length === 0) {
    return c.json({ error: "Invalid or expired token" }, 403);
  }

  const { case_id } = tokenRes.rows[0];

  const docRes = await db.execute({
    sql: "SELECT id, document_type, label FROM required_documents WHERE case_id = ? AND id = ?",
    args: [case_id, requiredDocId],
  });

  if (docRes.rows.length === 0) {
    return c.json({ error: "Document requirement not found" }, 400);
  }

  const reqDoc = docRes.rows[0];
  const uploadId = crypto.randomUUID();
  const fileKey = `${case_id}/direct_${reqDoc.document_type}_${uploadId.slice(0, 8)}`;
  const label = file.name || reqDoc.label || reqDoc.document_type;
  const contentType = file.type || "application/octet-stream";

  try {
    if (c.env.DOCUMENT_BUCKET && typeof c.env.DOCUMENT_BUCKET.put === 'function') {
      await c.env.DOCUMENT_BUCKET.put(fileKey, file.stream ? file.stream() : await file.arrayBuffer(), {
        httpMetadata: { contentType: contentType }
      });
    }

    await db.execute({
      sql: `INSERT INTO uploaded_documents (id, case_id, required_doc_id, file_label, s3_key, content_type, ocr_status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      args: [uploadId, case_id, requiredDocId, label, fileKey, contentType],
    });

    await db.execute({
      sql: "UPDATE required_documents SET status = 'received' WHERE id = ?",
      args: [requiredDocId]
    });

    await db.execute({
      sql: "UPDATE loan_cases SET last_updated = datetime('now') WHERE id = ?",
      args: [case_id]
    });

    return c.json({ success: true, uploadId, fileKey });
  } catch (err) {
    console.error("Direct upload failed", err);
    return c.json({ error: "Direct upload failed: " + err.message }, 500);
  }
}
