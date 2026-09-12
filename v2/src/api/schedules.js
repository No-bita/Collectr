/**
 * Schedules API Controller
 * Provides endpoints for creating, listing, cancelling schedules, and safe manual retry.
 */

import { getDbClient } from "../db/client.js";
import { toSqliteUtc, isValidTimezone } from "../scheduler/time.js";

const VALID_INTERVALS = ["daily", "weekly", "monthly"];
const VALID_SCHEDULE_TYPES = ["one_off", "recurring"];

export async function handleCreateSchedule(c) {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDbClient(c.env);
  const body = await c.req.json().catch(() => ({}));

  const {
    caseId = null,
    contactId = null,
    phoneNumber,
    templateName,
    templateParams = [],
    scheduleType = "one_off",
    recurrenceInterval = null,
    timezone = "Asia/Kolkata",
    scheduledFor
  } = body;

  if (!phoneNumber) {
    return c.json({ error: "Phone number is required" }, 400);
  }

  const cleanedPhone = String(phoneNumber).replace(/\D/g, "");
  if (cleanedPhone.length < 10) {
    return c.json({ error: "Valid 10-digit phone number required" }, 400);
  }

  if (!templateName) {
    return c.json({ error: "Template name is required" }, 400);
  }

  if (!VALID_SCHEDULE_TYPES.includes(scheduleType)) {
    return c.json({ error: "Invalid scheduleType. Must be 'one_off' or 'recurring'" }, 400);
  }

  if (scheduleType === "recurring" && (!recurrenceInterval || !VALID_INTERVALS.includes(recurrenceInterval))) {
    return c.json({ error: "Recurring schedules require recurrenceInterval: 'daily', 'weekly', or 'monthly'" }, 400);
  }

  const safeTz = isValidTimezone(timezone) ? timezone : "UTC";

  // Compute scheduled_for_utc
  let scheduledForUtc;
  if (scheduledFor) {
    const d = new Date(scheduledFor);
    if (isNaN(d.getTime())) {
      return c.json({ error: "Invalid scheduledFor date format" }, 400);
    }
    scheduledForUtc = toSqliteUtc(d);
  } else {
    // Default to immediately / current timestamp
    scheduledForUtc = toSqliteUtc(new Date());
  }

  const scheduleId = `sch_${crypto.randomUUID()}`;
  const occurrenceId = `occ_${crypto.randomUUID()}`;
  const occurrenceKey = `${scheduleId}_${scheduledForUtc}`;

  // Insert schedule (NO credit deduction on creation as per architectural specification)
  await db.execute({
    sql: `
      INSERT INTO schedules (
        id, user_id, case_id, contact_id, phone_number, template_name,
        template_params, schedule_type, recurrence_interval, timezone,
        status, next_run_utc
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `,
    args: [
      scheduleId,
      user.id,
      caseId,
      contactId,
      cleanedPhone,
      templateName,
      JSON.stringify(templateParams),
      scheduleType,
      recurrenceInterval,
      safeTz,
      scheduledForUtc
    ]
  });

  // Insert initial pending occurrence
  await db.execute({
    sql: `
      INSERT INTO scheduled_occurrences (
        id, schedule_id, occurrence_key, scheduled_for_utc, operational_status
      ) VALUES (?, ?, ?, ?, 'pending')
    `,
    args: [occurrenceId, scheduleId, occurrenceKey, scheduledForUtc]
  });

  return c.json({
    success: true,
    schedule: {
      id: scheduleId,
      scheduleType,
      recurrenceInterval,
      timezone: safeTz,
      scheduledForUtc,
      status: "active"
    },
    occurrence: {
      id: occurrenceId,
      occurrenceKey,
      scheduledForUtc,
      operationalStatus: "pending"
    }
  }, 201);
}

export async function handleGetSchedules(c) {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDbClient(c.env);
  const isAdmin = String(user.role).toLowerCase() === "admin";

  let sql = `
    SELECT s.*, 
           o.id as occurrence_id,
           o.scheduled_for_utc as occurrence_scheduled_for,
           o.operational_status as occurrence_status,
           o.attempts as occurrence_attempts,
           o.provider_message_id,
           o.skip_reason,
           o.last_error,
           o.executed_at as occurrence_executed_at
    FROM schedules s
    LEFT JOIN scheduled_occurrences o ON o.schedule_id = s.id
    WHERE 1=1
  `;
  const args = [];

  if (!isAdmin) {
    sql += " AND s.user_id = ?";
    args.push(user.id);
  }

  sql += " ORDER BY s.created_at DESC, o.scheduled_for_utc DESC LIMIT 100";

  const res = await db.execute({ sql, args });
  return c.json({ schedules: res.rows || [] });
}

export async function handleCancelSchedule(c) {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const scheduleId = c.req.param("id");
  const db = getDbClient(c.env);
  const isAdmin = String(user.role).toLowerCase() === "admin";

  let checkSql = "SELECT id, user_id, status FROM schedules WHERE id = ?";
  const checkArgs = [scheduleId];
  if (!isAdmin) {
    checkSql += " AND user_id = ?";
    checkArgs.push(user.id);
  }

  const checkRes = await db.execute({ sql: checkSql, args: checkArgs });
  if (!checkRes.rows || checkRes.rows.length === 0) {
    return c.json({ error: "Schedule not found or unauthorized" }, 404);
  }

  // Cancel schedule
  await db.execute({
    sql: "UPDATE schedules SET status = 'cancelled', cancelled_at = datetime('now'), next_run_utc = NULL WHERE id = ?",
    args: [scheduleId]
  });

  // Cancel any unexecuted occurrences
  await db.execute({
    sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'cancelled', executed_at = datetime('now') WHERE schedule_id = ? AND operational_status IN ('pending', 'claimed')",
    args: [scheduleId]
  });

  return c.json({ success: true, message: "Schedule cancelled" });
}

export async function handleRetryOccurrence(c) {
  const user = c.get("user");
  if (!user?.id) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const occurrenceId = c.req.param("id");
  const db = getDbClient(c.env);
  const body = await c.req.json().catch(() => ({}));
  const isAdmin = String(user.role).toLowerCase() === "admin";

  const queryRes = await db.execute({
    sql: `
      SELECT o.*, s.user_id, s.status as schedule_status
      FROM scheduled_occurrences o
      JOIN schedules s ON o.schedule_id = s.id
      WHERE o.id = ?
    `,
    args: [occurrenceId]
  });

  const row = queryRes.rows?.[0];
  if (!row) {
    return c.json({ error: "Occurrence not found" }, 404);
  }

  if (!isAdmin && row.user_id !== user.id) {
    return c.json({ error: "Unauthorized" }, 403);
  }

  if (row.operational_status === "completed") {
    return c.json({ error: "Occurrence already completed successfully" }, 400);
  }

  // Strict UNKNOWN semantics: Do not automatically retry unknown outcomes
  if (row.operational_status === "unknown" && !body.forceDuplicateRiskAcknowledgement) {
    return c.json({
      error: "UNKNOWN_DUPLICATE_RISK",
      message: "Unknown — possible duplicate. Manual verification required.",
      warning: "Meta may already have received and dispatched this message. Retrying may create duplicate outreach for the recipient. If verified, retry with forceDuplicateRiskAcknowledgement: true."
    }, 400);
  }

  // Reset occurrence for retry
  await db.execute({
    sql: `
      UPDATE scheduled_occurrences
      SET operational_status = 'pending',
          claimed_at = NULL,
          last_error = NULL,
          skip_reason = NULL,
          scheduled_for_utc = datetime('now')
      WHERE id = ?
    `,
    args: [occurrenceId]
  });

  return c.json({
    success: true,
    message: "Occurrence reset to pending for retry"
  });
}
