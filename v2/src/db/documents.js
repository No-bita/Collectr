/** Firm-scoped reads only. The completion handler (#7) owns verified receipt inserts. */
export async function getDocument(db, { firmId, documentId }) {
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE id = ? AND firm_id = ?",
    args: [documentId, firmId],
  });
  return result.rows[0] ?? null;
}

export async function listItemDocuments(db, { firmId, requestId, itemId }) {
  const result = await db.execute({
    sql: "SELECT * FROM documents WHERE firm_id = ? AND request_id = ? AND item_id = ? ORDER BY version DESC",
    args: [firmId, requestId, itemId],
  });
  return result.rows;
}
