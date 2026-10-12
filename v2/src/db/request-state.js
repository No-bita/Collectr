import { getDbClient } from "./client.js";
import {
  StateConflict,
  requestProgress as computeProgress,
  validateItemTransition,
  validateRequestClose,
} from "../domain/states.js";

/** The one write path for request_items.status and for closing a request. */

export class NotFoundError extends Error {
  constructor(message) {
    super(message);
    this.name = "NotFoundError";
    this.status = 404;
  }
  toJSON() {
    return { error: this.message };
  }
}

function requireFirm(scope) {
  const firmId = scope?.firmId;
  if (typeof firmId !== "string" || !firmId) {
    throw new TypeError("A firmId scope is required.");
  }
  return firmId;
}

function changesOf(result) {
  return Number(result?.meta?.changes ?? result?.changes ?? result?.rowsAffected ?? 0);
}

async function loadItem(db, itemId, firmId, requestId) {
  const args = [itemId, firmId];
  let sql = `SELECT i.id, i.request_id, i.title, i.required, i.status,
                    r.user_id AS owner_user_id, r.contact_id, r.firm_id
             FROM request_items i JOIN requests r ON r.id = i.request_id
             WHERE i.id = ? AND r.firm_id = ? AND i.firm_id = r.firm_id`;
  if (requestId) {
    sql += " AND i.request_id = ?";
    args.push(requestId);
  }
  const res = await db.execute({ sql: `${sql} LIMIT 1`, args });
  return res.rows[0] || null;
}

/**
 * Move one item along a legal edge. The UPDATE only matches while the status is
 * still the one we validated against (compare-and-set), and the event row is
 * inserted in the same batch only if that UPDATE changed a row. A stale or
 * concurrent writer gets StateConflict with the current status.
 * scope: { firmId, requestId? }. Callers authenticate the actor and the firm.
 */
export async function transitionItem(dbOrEnv, itemId, toStatus, actor, reason, scope) {
  const db = getDbClient(dbOrEnv);
  const firmId = requireFirm(scope);
  const item = await loadItem(db, itemId, firmId, scope.requestId);
  if (!item) throw new NotFoundError("Request item not found.");

  const plan = validateItemTransition(item.status, toStatus, actor, reason);
  const eventId = "act_" + crypto.randomUUID();
  const metadata = JSON.stringify({
    itemId,
    from: plan.fromStatus,
    to: plan.toStatus,
    actor: plan.actorType,
    reason: plan.reason,
  });

  const results = await db.batch([
    {
      sql: `UPDATE request_items SET status = ?, updated_at = datetime('now')
            WHERE id = ? AND firm_id = ? AND status = ?`,
      args: [plan.toStatus, itemId, firmId, plan.fromStatus],
    },
    {
      sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
            SELECT ?, ?, ?, ?, 'item_transition', 'Item status changed', ?, ?, datetime('now'), ?
            WHERE changes() > 0`,
      args: [
        eventId,
        actor.userId || item.owner_user_id,
        item.contact_id,
        item.request_id,
        `${item.title}: ${plan.fromStatus} to ${plan.toStatus}`,
        metadata,
        firmId,
      ],
    },
  ]);

  if (changesOf(results[0]) !== 1) {
    const now = await loadItem(db, itemId, firmId, scope.requestId);
    throw new StateConflict("Item changed while updating. Reload and retry.", now ? now.status : plan.fromStatus);
  }
  return Object.freeze({ itemId, requestId: item.request_id, fromStatus: plan.fromStatus, status: plan.toStatus, eventId });
}

/** Load every item of a request (firm-scoped) and count them. Null if the request is not in this firm. */
export async function requestProgress(dbOrEnv, requestId, firmId) {
  const db = getDbClient(dbOrEnv);
  requireFirm({ firmId });
  const req = await db.execute({
    sql: "SELECT id, status FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
    args: [requestId, firmId],
  });
  if (req.rows.length === 0) return null;
  const items = await db.execute({
    sql: "SELECT status, required FROM request_items WHERE request_id = ? AND firm_id = ?",
    args: [requestId, firmId],
  });
  return computeProgress(items.rows);
}

const NON_CLOSABLE = ["closed", "cancelled"];

/**
 * Close a request once every required item is accepted or waived. The UPDATE
 * repeats that rule in SQL, so an item moving after our read still blocks it.
 */
export async function closeRequest(dbOrEnv, requestId, scope) {
  const db = getDbClient(dbOrEnv);
  const firmId = requireFirm(scope);
  const reqRes = await db.execute({
    sql: "SELECT id, user_id, contact_id, title, status FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
    args: [requestId, firmId],
  });
  const request = reqRes.rows[0];
  if (!request) throw new NotFoundError("Request not found.");
  if (NON_CLOSABLE.includes(request.status)) {
    throw new StateConflict(`Request is already ${request.status}.`, request.status);
  }
  const itemsRes = await db.execute({
    sql: "SELECT status, required FROM request_items WHERE request_id = ? AND firm_id = ?",
    args: [requestId, firmId],
  });
  validateRequestClose(itemsRes.rows, request.status);

  const completedAt = new Date().toISOString();
  const results = await db.batch([
    {
      sql: `UPDATE requests SET status = 'closed', completed_at = ?, updated_at = datetime('now')
            WHERE id = ? AND firm_id = ? AND status NOT IN ('closed', 'cancelled')
              AND NOT EXISTS (SELECT 1 FROM request_items
                              WHERE request_id = ? AND required = 1 AND status NOT IN ('accepted', 'waived'))`,
      args: [completedAt, requestId, firmId, requestId],
    },
    {
      sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
            SELECT ?, ?, ?, ?, 'request_completed', 'Request closed', ?, ?, datetime('now'), ?
            WHERE changes() > 0`,
      args: [
        "act_" + crypto.randomUUID(),
        scope.userId || request.user_id,
        request.contact_id,
        requestId,
        request.title,
        JSON.stringify({ previousStatus: request.status, newStatus: "closed" }),
        firmId,
      ],
    },
  ]);
  if (changesOf(results[0]) !== 1) {
    const now = await db.execute({
      sql: "SELECT status FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [requestId, firmId],
    });
    throw new StateConflict("Request changed while closing. Reload and retry.", now.rows[0]?.status ?? request.status);
  }
  return Object.freeze({ requestId, status: "closed", completedAt, previousStatus: request.status });
}
