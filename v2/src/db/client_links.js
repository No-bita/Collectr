/**
 * Client link helpers (issue #3).
 *
 * A client link is a random bearer token that opens one request's upload
 * portal. Only the SHA-256 hash of the token is stored (client_links table,
 * migration 0005); the raw token is returned to staff exactly once at
 * creation and can never be recovered afterwards.
 *
 * Every helper is firm-scoped: links can only be created, revoked or
 * regenerated against a request owned by the caller's firm.
 *
 * The route wiring that exposes these helpers (staff link routes and the
 * public session route) is issue #4.
 */

const TOKEN_BYTES = 32;
const DEFAULT_EXPIRY_DAYS = 14;

function base64UrlEncode(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function hexEncode(bytes) {
  let hex = "";
  for (const byte of bytes) hex += byte.toString(16).padStart(2, "0");
  return hex;
}

/** SHA-256 hex digest of a raw token. This is the only token form ever stored. */
export async function hashToken(rawToken) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  return hexEncode(new Uint8Array(digest));
}

/**
 * Generates a new bearer token: 32 random bytes from crypto.getRandomValues,
 * base64url-encoded. Returns { token, tokenHash }; `token` goes to the client
 * exactly once and is never stored.
 */
export async function generateToken() {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  const token = base64UrlEncode(bytes);
  return { token, tokenHash: await hashToken(token) };
}

function defaultExpiresAt(now = new Date()) {
  return new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

async function getFirmRequest(db, firmId, requestId) {
  const res = await db.execute({
    sql: "SELECT id, status FROM requests WHERE id = ? AND firm_id = ?",
    args: [requestId, firmId],
  });
  return res.rows[0] ?? null;
}

/**
 * Creates a link for a request owned by the firm. Returns
 * { ok: true, link, token } — `token` is shown once — or
 * { ok: false, reason: "request_not_found" } when the request does not exist
 * or belongs to another firm.
 */
export async function createLink(db, { firmId, requestId, createdBy, expiresAt } = {}) {
  const request = await getFirmRequest(db, firmId, requestId);
  if (!request) return { ok: false, reason: "request_not_found" };

  const { token, tokenHash } = await generateToken();
  const link = {
    id: "lnk_" + crypto.randomUUID(),
    firm_id: firmId,
    request_id: requestId,
    token_hash: tokenHash,
    expires_at: expiresAt || defaultExpiresAt(),
    revoked_at: null,
    created_by: createdBy,
  };
  await db.execute({
    sql: `INSERT INTO client_links (id, firm_id, request_id, token_hash, expires_at, created_by)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: [link.id, link.firm_id, link.request_id, link.token_hash, link.expires_at, link.created_by],
  });
  return { ok: true, link, token };
}

/**
 * Resolves a raw bearer token to its link and request.
 * Returns { ok: true, link, request } only when the hash matches a link that
 * is unrevoked, unexpired, and whose request is still open; otherwise
 * { ok: false, reason } with reason one of "not_found" | "revoked" |
 * "expired" | "request_closed". A successful resolution stamps last_used_at.
 */
export async function resolveLink(db, rawToken, { now = new Date() } = {}) {
  if (!rawToken) return { ok: false, reason: "not_found" };

  const tokenHash = await hashToken(rawToken);
  const found = await db.execute({
    sql: `SELECT l.id, l.firm_id, l.request_id, l.expires_at, l.revoked_at, l.created_by, l.created_at,
                 r.status AS request_status
          FROM client_links l
          JOIN requests r ON r.id = l.request_id
          WHERE l.token_hash = ?`,
    args: [tokenHash],
  });
  const row = found.rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.revoked_at) return { ok: false, reason: "revoked" };
  const expiresAtMs = Date.parse(row.expires_at);
  if (Number.isNaN(expiresAtMs) || expiresAtMs <= now.getTime()) {
    return { ok: false, reason: "expired" };
  }
  if (row.request_status !== "open") return { ok: false, reason: "request_closed" };

  await db.execute({
    sql: "UPDATE client_links SET last_used_at = datetime('now') WHERE id = ?",
    args: [row.id],
  });

  const reqRes = await db.execute({
    sql: "SELECT * FROM requests WHERE id = ?",
    args: [row.request_id],
  });
  const { request_status, ...link } = row;
  return { ok: true, link, request: reqRes.rows[0] ?? null };
}

/**
 * Revokes one link owned by the firm. Idempotent: revoking an already-revoked
 * link still returns ok. Returns { ok: false, reason: "not_found" } when no
 * such link exists for the firm.
 */
export async function revokeLink(db, { firmId, linkId } = {}) {
  const res = await db.execute({
    sql: "UPDATE client_links SET revoked_at = datetime('now') WHERE id = ? AND firm_id = ? AND revoked_at IS NULL",
    args: [linkId, firmId],
  });
  if ((res.changes ?? 0) === 0) {
    const existing = await db.execute({
      sql: "SELECT id FROM client_links WHERE id = ? AND firm_id = ?",
      args: [linkId, firmId],
    });
    if (!existing.rows[0]) return { ok: false, reason: "not_found" };
    return { ok: true, alreadyRevoked: true };
  }
  return { ok: true, alreadyRevoked: false };
}

/**
 * Revokes every active link on a firm-owned request and issues a fresh one in
 * a single batch. Returns { ok: true, link, token, revokedCount } or
 * { ok: false, reason: "request_not_found" }.
 */
export async function regenerateLink(db, { firmId, requestId, createdBy, expiresAt } = {}) {
  const request = await getFirmRequest(db, firmId, requestId);
  if (!request) return { ok: false, reason: "request_not_found" };

  const { token, tokenHash } = await generateToken();
  const link = {
    id: "lnk_" + crypto.randomUUID(),
    firm_id: firmId,
    request_id: requestId,
    token_hash: tokenHash,
    expires_at: expiresAt || defaultExpiresAt(),
    revoked_at: null,
    created_by: createdBy,
  };
  const results = await db.batch([
    {
      sql: "UPDATE client_links SET revoked_at = datetime('now') WHERE request_id = ? AND firm_id = ? AND revoked_at IS NULL",
      args: [requestId, firmId],
    },
    {
      sql: `INSERT INTO client_links (id, firm_id, request_id, token_hash, expires_at, created_by)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [link.id, link.firm_id, link.request_id, link.token_hash, link.expires_at, link.created_by],
    },
  ]);
  const revokedCount = Number(results?.[0]?.changes ?? results?.[0]?.rowsAffected ?? 0);
  return { ok: true, link, token, revokedCount };
}
