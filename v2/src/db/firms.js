/**
 * Firm tenancy helpers.
 *
 * Every private record (contacts, requests, activities) is owned by a firm.
 * A user's firm is resolved through firm_members; registration creates one
 * firm per user (role 'owner') and migration 0002 backfills the same shape
 * for pre-existing users.
 */

/**
 * Returns the firm_id for a user, or null when the user has no membership.
 */
export async function getFirmIdForUser(db, userId) {
  if (!userId) return null;
  const res = await db.execute({
    sql: "SELECT firm_id FROM firm_members WHERE user_id = ? LIMIT 1",
    args: [userId],
  });
  return res.rows[0]?.firm_id ?? null;
}

/**
 * Creates a firm owned by the given user and returns the new firm_id.
 * The firm id is derived from the user id, matching the 0002 backfill.
 */
export async function createFirmForUser(db, userId, firmName) {
  const firmId = "firm_" + userId;
  await db.execute({
    sql: "INSERT INTO firms (id, name, created_at) VALUES (?, ?, datetime('now'))",
    args: [firmId, firmName || "Unnamed Firm"],
  });
  await db.execute({
    sql: "INSERT INTO firm_members (firm_id, user_id, role, created_at) VALUES (?, ?, 'owner', datetime('now'))",
    args: [firmId, userId],
  });
  return firmId;
}
