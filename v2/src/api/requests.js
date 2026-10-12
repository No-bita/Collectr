import { getDbClient } from "../db/client.js";

const VALID_REQUEST_STATUSES = [
  "draft",
  "open",
  "waiting_on_them",
  "needs_follow_up",
  "waiting_on_me",
  "completed",
  "closed",
  "cancelled",
];

// Request statuses that lock the checklist: items cannot be added or edited.
const LOCKED_REQUEST_STATUSES = ["completed", "closed", "cancelled"];

// Statuses this generic endpoint may set on an item. received / under_review /
// accepted / needs_replacement are driven by upload and review flows, not here.
const MANUAL_ITEM_STATUSES = ["missing", "waived"];

const DEFAULT_ALLOWED_TYPES = "pdf,jpg,png";
const DEFAULT_MAX_BYTES = 15 * 1024 * 1024;
const CREATE_REQUEST_STATUSES = ["draft", "open"];

function normalizeAllowedTypes(value) {
  const list = Array.isArray(value) ? value : String(value).split(",");
  const types = [...new Set(list.map((t) => String(t).trim().toLowerCase().replace(/^\./, "")).filter(Boolean))];
  if (types.length === 0 || !types.every((t) => /^[a-z0-9]{1,10}$/.test(t))) return null;
  return types.join(",");
}

/**
 * Validates and normalises the optional checklist fields of an item payload.
 * Returns { error } or { fields } where fields only has keys that were provided.
 */
function parseItemFields(input) {
  const fields = {};
  if (input.title !== undefined) {
    const title = String(input.title || "").trim();
    if (!title) return { error: "Item title is required." };
    fields.title = title;
  }
  if (input.description !== undefined) {
    fields.description = input.description === null ? null : String(input.description).trim() || null;
  }
  if (input.required !== undefined) {
    if (![true, false, 0, 1].includes(input.required)) return { error: "required must be true or false." };
    fields.required = input.required ? 1 : 0;
  }
  const allowed = input.allowedTypes ?? input.allowed_types;
  if (allowed !== undefined) {
    const normalized = normalizeAllowedTypes(allowed);
    if (!normalized) return { error: "allowedTypes must be a list of file extensions such as pdf,jpg,png." };
    fields.allowed_types = normalized;
  }
  const maxBytes = input.maxBytes ?? input.max_bytes;
  if (maxBytes !== undefined) {
    if (!Number.isInteger(maxBytes) || maxBytes <= 0) return { error: "maxBytes must be a positive integer." };
    fields.max_bytes = maxBytes;
  }
  if (input.position !== undefined) {
    if (!Number.isInteger(input.position) || input.position < 0) return { error: "position must be a non-negative integer." };
    fields.position = input.position;
  }
  return { fields };
}

function shapeItem(row) {
  return {
    id: row.id,
    requestId: row.request_id,
    title: row.title,
    description: row.description ?? null,
    position: row.position,
    required: row.required === 1,
    allowedTypes: row.allowed_types,
    maxBytes: row.max_bytes,
    status: row.status,
  };
}

/**
 * POST /api/contacts/:id/requests
 * Creates a new request with optional checklist items for a contact.
 */
export async function handleCreateRequest(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const userId = user.id;
  const firmId = c.get("firmId");
  if (!firmId) {
    return c.json({ error: "Access denied. This user has no firm membership." }, 403);
  }
  const contactId = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const title = String(body.title || "").trim();
  const description = body.description ? String(body.description).trim() : null;
  const dueDate = body.dueDate || null;
  const serviceType = body.serviceType ? String(body.serviceType).trim() || null : null;
  const periodLabel = body.periodLabel ? String(body.periodLabel).trim() || null : null;
  const requestStatus = body.status === undefined ? "open" : String(body.status).trim().toLowerCase();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!title) {
    return c.json({ error: "Request title is required." }, 400);
  }
  if (!CREATE_REQUEST_STATUSES.includes(requestStatus)) {
    return c.json({ error: `Invalid status. A new request must be one of: ${CREATE_REQUEST_STATUSES.join(", ")}` }, 400);
  }

  // Validate every item before writing anything.
  const parsedItems = [];
  for (const item of items) {
    const raw = typeof item === "string" ? { title: item } : item || {};
    if (!String(raw.title || "").trim()) continue; // blank titles are skipped, as before
    const parsed = parseItemFields({ ...raw, position: undefined });
    if (parsed.error) return c.json({ error: parsed.error }, 400);
    parsedItems.push(parsed.fields);
  }

  try {
    // Verify contact ownership
    const contactRes = await db.execute({
      sql: "SELECT id, name FROM contacts WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [contactId, firmId],
    });

    if (contactRes.rows.length === 0) {
      return c.json({ error: "Contact not found." }, 404);
    }

    const requestId = "req_" + crypto.randomUUID();

    await db.execute({
      sql: `INSERT INTO requests (id, user_id, firm_id, contact_id, title, description, status, due_date, service_type, period_label, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      args: [requestId, userId, firmId, contactId, title, description, requestStatus, dueDate, serviceType, periodLabel],
    });

    // Insert checklist items; positions follow the order sent (0-based, blank titles skipped).
    const createdItems = [];
    for (const fields of parsedItems) {
      if (!fields.title) continue;
      const itemId = "itm_" + crypto.randomUUID();
      const position = createdItems.length;
      await db.execute({
        sql: `INSERT INTO request_items (id, request_id, firm_id, title, description, position, required, allowed_types, max_bytes, status, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'missing', datetime('now'), datetime('now'))`,
        args: [
          itemId,
          requestId,
          firmId,
          fields.title,
          fields.description ?? null,
          position,
          fields.required ?? 1,
          fields.allowed_types ?? DEFAULT_ALLOWED_TYPES,
          fields.max_bytes ?? DEFAULT_MAX_BYTES,
        ],
      });
      createdItems.push(shapeItem({
        id: itemId,
        request_id: requestId,
        title: fields.title,
        description: fields.description ?? null,
        position,
        required: fields.required ?? 1,
        allowed_types: fields.allowed_types ?? DEFAULT_ALLOWED_TYPES,
        max_bytes: fields.max_bytes ?? DEFAULT_MAX_BYTES,
        status: "missing",
      }));
    }

    // Log Activity
    const actId = "act_" + crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
            VALUES (?, ?, ?, ?, 'request_created', 'Request Created', ?, ?, datetime('now'), ?)`,
      args: [actId, userId, contactId, requestId, title, JSON.stringify({ itemsCount: createdItems.length, dueDate }), firmId],
    });

    return c.json({
      success: true,
      request: {
        id: requestId,
        contactId,
        title,
        description,
        status: requestStatus,
        dueDate,
        serviceType,
        periodLabel,
        items: createdItems,
      },
    }, 201);
  } catch (err) {
    console.error("handleCreateRequest error:", err);
    return c.json({ error: "Failed to create request", details: err.message }, 500);
  }
}

/**
 * PATCH /api/requests/:id/status
 * Updates request status strictly following the state machine.
 */
export async function handleUpdateRequestStatus(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const userId = user.id;
  const firmId = c.get("firmId");
  if (!firmId) {
    return c.json({ error: "Access denied. This user has no firm membership." }, 403);
  }
  const requestId = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const targetStatus = String(body.status || "").trim().toLowerCase();

  if (!VALID_REQUEST_STATUSES.includes(targetStatus)) {
    return c.json({
      error: `Invalid status. Valid statuses are: ${VALID_REQUEST_STATUSES.join(", ")}`,
    }, 400);
  }

  try {
    const reqRes = await db.execute({
      sql: "SELECT * FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [requestId, firmId],
    });

    if (reqRes.rows.length === 0) {
      return c.json({ error: "Request not found." }, 404);
    }

    const currentReq = reqRes.rows[0];
    const completedAt = targetStatus === "completed" ? new Date().toISOString() : null;

    await db.execute({
      sql: `UPDATE requests SET status = ?, completed_at = ?, updated_at = datetime('now') WHERE id = ? AND firm_id = ?`,
      args: [targetStatus, completedAt, requestId, firmId],
    });

    // Log Activity
    const actId = "act_" + crypto.randomUUID();
    const actType = targetStatus === "completed" ? "request_completed" : "request_status_updated";
    await db.execute({
      sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)`,
      args: [
        actId,
        userId,
        currentReq.contact_id,
        requestId,
        actType,
        `Request marked ${targetStatus.replace(/_/g, " ")}`,
        currentReq.title,
        JSON.stringify({ previousStatus: currentReq.status, newStatus: targetStatus }),
        firmId,
      ],
    });

    return c.json({
      success: true,
      request: {
        id: requestId,
        status: targetStatus,
        completedAt,
      },
    });
  } catch (err) {
    console.error("handleUpdateRequestStatus error:", err);
    return c.json({ error: "Failed to update request status", details: err.message }, 500);
  }
}

/**
 * PATCH /api/requests/:requestId/items/:itemId
 * Edits an item (title, description, required, position, allowedTypes, maxBytes) and/or
 * sets its status to missing or waived. Not allowed once the request is completed, closed or cancelled.
 */
export async function handleUpdateRequestItem(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const userId = user.id;
  const firmId = c.get("firmId");
  if (!firmId) {
    return c.json({ error: "Access denied. This user has no firm membership." }, 403);
  }
  const requestId = c.req.param("requestId");
  const itemId = c.req.param("itemId");

  const body = await c.req.json().catch(() => ({}));

  const parsed = parseItemFields(body);
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  const fields = parsed.fields;

  if (body.status !== undefined) {
    const status = String(body.status || "").trim().toLowerCase();
    if (!MANUAL_ITEM_STATUSES.includes(status)) {
      return c.json({
        error: `Invalid item status. This endpoint can only set: ${MANUAL_ITEM_STATUSES.join(", ")}`,
      }, 400);
    }
    fields.status = status;
  }

  if (Object.keys(fields).length === 0) {
    return c.json({ error: "Nothing to update." }, 400);
  }

  try {
    // Verify request ownership
    const reqRes = await db.execute({
      sql: "SELECT * FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [requestId, firmId],
    });

    if (reqRes.rows.length === 0) {
      return c.json({ error: "Request not found." }, 404);
    }

    const currentReq = reqRes.rows[0];
    if (LOCKED_REQUEST_STATUSES.includes(currentReq.status)) {
      return c.json({ error: `Items cannot be edited on a ${currentReq.status} request.` }, 409);
    }

    const columns = Object.keys(fields);
    const res = await db.execute({
      sql: `UPDATE request_items SET ${columns.map((col) => `${col} = ?`).join(", ")}, updated_at = datetime('now') WHERE id = ? AND request_id = ?`,
      args: [...columns.map((col) => fields[col]), itemId, requestId],
    });

    if (res.rowsAffected === 0 || res.changes === 0) {
      return c.json({ error: "Request item not found." }, 404);
    }

    // Log Activity
    const actId = "act_" + crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO activities (id, user_id, contact_id, request_id, activity_type, title, description, metadata, created_at, firm_id)
            VALUES (?, ?, ?, ?, 'request_item_done', 'Item Updated', ?, ?, datetime('now'), ?)`,
      args: [actId, userId, currentReq.contact_id, requestId, `Item updated (${columns.join(", ")})`, JSON.stringify({ itemId, changes: fields }), firmId],
    });

    const itemRes = await db.execute({
      sql: "SELECT * FROM request_items WHERE id = ? AND request_id = ? LIMIT 1",
      args: [itemId, requestId],
    });

    return c.json({ success: true, itemId, item: shapeItem(itemRes.rows[0]) });
  } catch (err) {
    console.error("handleUpdateRequestItem error:", err);
    return c.json({ error: "Failed to update request item", details: err.message }, 500);
  }
}

/**
 * POST /api/requests/:id/items
 * Adds a checklist item to an existing request (appended after the last position).
 * Not allowed once the request is completed, closed or cancelled.
 */
export async function handleAddRequestItem(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  const userId = user.id;
  const firmId = c.get("firmId");
  if (!firmId) {
    return c.json({ error: "Access denied. This user has no firm membership." }, 403);
  }
  const requestId = c.req.param("id");

  const body = await c.req.json().catch(() => ({}));
  const parsed = parseItemFields({ ...body, title: body.title === undefined ? "" : body.title });
  if (parsed.error) return c.json({ error: parsed.error }, 400);
  const fields = parsed.fields;

  try {
    const reqRes = await db.execute({
      sql: "SELECT * FROM requests WHERE id = ? AND firm_id = ? LIMIT 1",
      args: [requestId, firmId],
    });

    if (reqRes.rows.length === 0) {
      return c.json({ error: "Request not found." }, 404);
    }

    if (LOCKED_REQUEST_STATUSES.includes(reqRes.rows[0].status)) {
      return c.json({ error: `Items cannot be added to a ${reqRes.rows[0].status} request.` }, 409);
    }

    let position = fields.position;
    if (position === undefined) {
      const posRes = await db.execute({
        sql: "SELECT COALESCE(MAX(position) + 1, 0) AS next_position FROM request_items WHERE request_id = ?",
        args: [requestId],
      });
      position = posRes.rows[0].next_position;
    }

    const itemId = "itm_" + crypto.randomUUID();
    await db.execute({
      sql: `INSERT INTO request_items (id, request_id, firm_id, title, description, position, required, allowed_types, max_bytes, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'missing', datetime('now'), datetime('now'))`,
      args: [
        itemId,
        requestId,
        firmId,
        fields.title,
        fields.description ?? null,
        position,
        fields.required ?? 1,
        fields.allowed_types ?? DEFAULT_ALLOWED_TYPES,
        fields.max_bytes ?? DEFAULT_MAX_BYTES,
      ],
    });

    const itemRes = await db.execute({
      sql: "SELECT * FROM request_items WHERE id = ? LIMIT 1",
      args: [itemId],
    });

    return c.json({ success: true, item: shapeItem(itemRes.rows[0]) }, 201);
  } catch (err) {
    console.error("handleAddRequestItem error:", err);
    return c.json({ error: "Failed to add request item", details: err.message }, 500);
  }
}
