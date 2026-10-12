import { getDbClient } from "../db/client.js";
import { resolveLink } from "../db/client_links.js";

const LINK_FAILURE_STATUS = Object.freeze({ not_found: 404, expired: 410, revoked: 410, request_closed: 409 });

export async function handleSessionRequest(c) {
  c.header("Cache-Control", "no-store");
  c.header("Referrer-Policy", "no-referrer");
  try {
    const db = getDbClient(c.env);
    const resolved = await resolveLink(db, c.req.param("token"));
    if (!resolved.ok) {
      return c.json({ error: resolved.reason }, LINK_FAILURE_STATUS[resolved.reason] ?? 404);
    }
    const { link, request } = resolved;
    if (!request || request.firm_id !== link.firm_id) return c.json({ error: "not_found" }, 404);
    const identity = await db.execute({
      sql: `SELECT f.name AS firm_name, c.name AS client_name FROM firms f
            JOIN contacts c ON c.firm_id = f.id
            WHERE f.id = ? AND c.id = ? LIMIT 1`,
      args: [link.firm_id, request.contact_id],
    });
    if (!identity.rows[0]) return c.json({ error: "not_found" }, 404);
    const result = await db.execute({
      sql: `SELECT id, title, description, required, status, allowed_types, max_bytes
            FROM request_items WHERE request_id = ? AND firm_id = ? ORDER BY position, id`,
      args: [request.id, link.firm_id],
    });
    // Issue #5 installs documents. A pre-#5 database has no uploads, not a broken session.
    // Check table presence explicitly so unrelated database failures still fail closed.
    const table = await db.execute({ sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'documents'", args: [] });
    const counts = new Map();
    if (table.rows.length) {
      const uploads = await db.execute({
        sql: `SELECT item_id, COUNT(*) AS upload_count FROM documents
              WHERE request_id = ? AND firm_id = ? AND state NOT IN ('rejected', 'superseded') GROUP BY item_id`,
        args: [request.id, link.firm_id],
      });
      for (const row of uploads.rows) counts.set(row.item_id, Number(row.upload_count));
    }
    return c.json({
      firm_name: identity.rows[0].firm_name,
      client_name: identity.rows[0].client_name,
      service_type: request.service_type ?? null,
      due_date: request.due_date ?? null,
      items: result.rows.map((row) => ({
        id: row.id, title: row.title, description: row.description ?? null,
        required: row.required === 1, status: row.status,
        allowed_types: row.allowed_types, max_bytes: row.max_bytes,
        upload_count: counts.get(row.id) ?? 0,
      })),
    });
  } catch {
    // Do not log exceptions: token-bearing request URLs may be present in them.
    return c.json({ error: "session_unavailable" }, 500);
  }
}
