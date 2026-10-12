import { getDbClient } from "../db/client.js";
import { createLink, revokeLink, regenerateLink } from "../db/client_links.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function privateResponse(c) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
}

async function staffRequest(c, db) {
  const firmId = c.get("firmId");
  const user = c.get("user");
  const userId = user?.id ?? user?.sub ?? user?.user_id;
  if (!firmId || !userId) return { response: c.json({ error: "Firm membership required." }, 403) };
  const result = await db.execute({
    sql: "SELECT id, status, due_date FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
    args: [c.req.param("id"), firmId],
  });
  if (!result.rows[0]) return { response: c.json({ error: "Request not found." }, 404) };
  return { firmId, userId, request: result.rows[0] };
}

function publicLink(row, requestStatus, now = Date.now()) {
  return {
    id: row.id,
    expires_at: row.expires_at,
    revoked_at: row.revoked_at ?? null,
    created_at: row.created_at ?? null,
    last_used_at: row.last_used_at ?? null,
    status: row.revoked_at ? "revoked"
      : !Number.isFinite(Date.parse(row.expires_at)) || Date.parse(row.expires_at) <= now ? "expired"
      : requestStatus !== "open" ? "request_closed" : "active",
  };
}

async function issueLink(c, regenerate) {
  privateResponse(c);
  try {
    const db = getDbClient(c.env);
    const scope = await staffRequest(c, db);
    if (scope.response) return scope.response;
    if (scope.request.status !== "open") return c.json({ error: "request_closed" }, 409);
    let body = {};
    const text = await c.req.text().catch(() => "");
    if (text && text.trim()) {
      try { body = JSON.parse(text); } catch { return c.json({ error: "A JSON object is required." }, 400); }
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) return c.json({ error: "A JSON object is required." }, 400);
    const now = Date.now();
    const supplied = Object.hasOwn(body, "expiresAt") ? body.expiresAt : body.expires_at;
    let expiresAtMs;
    if (supplied !== undefined) {
      // Require an explicit UTC/offset timestamp, not a local-time or numeric guess.
      if (typeof supplied !== "string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(supplied)) {
        return c.json({ error: "expiresAt must be an ISO timestamp with a timezone." }, 400);
      }
      expiresAtMs = Date.parse(supplied);
    } else {
      const dueValue = scope.request.due_date;
      const utcDue = typeof dueValue === "string" && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$/.test(dueValue)
        ? dueValue.replace(" ", "T") + "Z" : dueValue;
      const due = utcDue ? Date.parse(utcDue) : NaN;
      expiresAtMs = Number.isFinite(due) ? due + 7 * DAY_MS : now + 14 * DAY_MS;
    }
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now) {
      return c.json({ error: "Link expiry must be in the future." }, 400);
    }
    const result = await (regenerate ? regenerateLink : createLink)(db, {
      firmId: scope.firmId, requestId: scope.request.id, createdBy: scope.userId,
      expiresAt: new Date(expiresAtMs).toISOString(),
    });
    if (!result.ok) return c.json({ error: "Request not found." }, 404);
    const url = new URL("/upload.html", c.req.url);
    url.searchParams.set("t", result.token);
    return c.json({
      success: true, link: publicLink(result.link, scope.request.status), token: result.token, url: url.href,
      ...(regenerate ? { revokedCount: result.revokedCount } : {}),
    }, 201);
  } catch {
    // Never log the token-bearing result or database error details.
    return c.json({ error: "Failed to issue client link." }, 500);
  }
}

export const handleCreateLink = (c) => issueLink(c, false);
export const handleRegenerateLink = (c) => issueLink(c, true);

export async function handleListLinks(c) {
  privateResponse(c);
  try {
    const db = getDbClient(c.env);
    const scope = await staffRequest(c, db);
    if (scope.response) return scope.response;
    const result = await db.execute({
      sql: `SELECT id, expires_at, revoked_at, created_at, last_used_at FROM client_links
            WHERE request_id = ? AND firm_id = ? ORDER BY created_at DESC, id`,
      args: [scope.request.id, scope.firmId],
    });
    return c.json({ links: result.rows.map((row) => publicLink(row, scope.request.status)) });
  } catch {
    return c.json({ error: "Failed to list client links." }, 500);
  }
}

export async function handleRevokeLink(c) {
  privateResponse(c);
  try {
    const db = getDbClient(c.env);
    const scope = await staffRequest(c, db);
    if (scope.response) return scope.response;
    // The helper scopes by firm only; bind this route's link to its request too.
    const found = await db.execute({
      sql: "SELECT id FROM client_links WHERE id = ? AND request_id = ? AND firm_id = ? LIMIT 1",
      args: [c.req.param("linkId"), scope.request.id, scope.firmId],
    });
    if (!found.rows[0]) return c.json({ error: "Link not found." }, 404);
    const result = await revokeLink(db, { firmId: scope.firmId, linkId: found.rows[0].id });
    if (!result.ok) return c.json({ error: "Link not found." }, 404);
    return c.json({ success: true, alreadyRevoked: result.alreadyRevoked });
  } catch {
    return c.json({ error: "Failed to revoke client link." }, 500);
  }
}
