/**
 * Scheduler Queue Consumer
 * Consumes occurrence messages from Cloudflare Queue, validates business eligibility
 * and JIT credit balance, and delegates dispatching to the existing WhatsApp pipeline.
 */

import { executeWhatsAppMessagingPipeline } from "../api/cases.js";
import { calculateNextRunUtc } from "./time.js";
import { MESSAGE_COST_PAISE } from "../api/credits.js";

const TERMINAL_CASE_STATUSES = ["closed", "disbursed"];

export async function processScheduledOccurrence(occurrenceId, env, db) {
  if (!occurrenceId) return { handled: false, reason: "missing_id" };

  // 1. Fetch occurrence with joined schedule
  const queryRes = await db.execute({
    sql: `
      SELECT o.id, o.schedule_id, o.occurrence_key, o.scheduled_for_utc, o.operational_status,
             s.user_id, s.case_id, s.contact_id, s.phone_number, s.template_name, s.template_params,
             s.schedule_type, s.recurrence_interval, s.timezone, s.status as schedule_status
      FROM scheduled_occurrences o
      JOIN schedules s ON o.schedule_id = s.id
      WHERE o.id = ?
    `,
    args: [occurrenceId]
  });

  const row = queryRes.rows?.[0];
  if (!row) {
    return { handled: false, reason: "occurrence_not_found" };
  }

  // 2. Schedule & occurrence status guards
  if (row.schedule_status === "cancelled") {
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'cancelled', executed_at = datetime('now') WHERE id = ?",
      args: [occurrenceId]
    });
    return { handled: true, status: "skipped", reason: "cancelled" };
  }

  if (row.schedule_status === "paused") {
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'schedule_paused', executed_at = datetime('now') WHERE id = ?",
      args: [occurrenceId]
    });
    return { handled: true, status: "skipped", reason: "schedule_paused" };
  }

  if (row.operational_status === "completed" || row.operational_status === "skipped" || row.operational_status === "unknown") {
    return { handled: true, status: row.operational_status, alreadyDone: true };
  }

  // 3. Case Eligibility Check (if linked to a case)
  let caseContactPerson = null;
  let caseItem = null;
  if (row.case_id) {
    const caseRes = await db.execute({
      sql: "SELECT id, status, contact_person, phone_number FROM loan_cases WHERE id = ?",
      args: [row.case_id]
    });
    caseItem = caseRes.rows?.[0];

    if (!caseItem) {
      await db.execute({
        sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'case_not_found', executed_at = datetime('now') WHERE id = ?",
        args: [occurrenceId]
      });
      return { handled: true, status: "skipped", reason: "case_not_found" };
    }

    if (TERMINAL_CASE_STATUSES.includes(String(caseItem.status).toLowerCase())) {
      // Case reached terminal state: skip occurrence and mark schedule completed
      await db.execute({
        sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'case_closed', executed_at = datetime('now') WHERE id = ?",
        args: [occurrenceId]
      });
      await db.execute({
        sql: "UPDATE schedules SET status = 'completed', next_run_utc = NULL WHERE id = ?",
        args: [row.schedule_id]
      });
      return { handled: true, status: "skipped", reason: "case_closed" };
    }

    caseContactPerson = caseItem.contact_person;
  }

  // 4. Contact / Phone Validation
  const rawPhone = row.phone_number || caseItem?.phone_number || "";
  const cleanedPhone = rawPhone.replace(/\D/g, "");
  if (!cleanedPhone || cleanedPhone.length < 10) {
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'invalid_phone', executed_at = datetime('now') WHERE id = ?",
      args: [occurrenceId]
    });
    await advanceRecurrenceIfApplicable(db, row);
    return { handled: true, status: "skipped", reason: "invalid_phone" };
  }

  // 5. User & JIT Credit Check (checked immediately before execution)
  const userRes = await db.execute({
    sql: "SELECT id, username, credit_balance FROM users WHERE id = ?",
    args: [row.user_id]
  });
  const user = userRes.rows?.[0] || { id: row.user_id, username: "Collectrr", credit_balance: 900 };

  const currentBalance = (user.credit_balance !== undefined && user.credit_balance !== null)
    ? Number(user.credit_balance)
    : 900;

  if (currentBalance < MESSAGE_COST_PAISE) {
    // Insufficient credits: skip this occurrence and advance schedule recurrence
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'insufficient_credits', executed_at = datetime('now') WHERE id = ?",
      args: [occurrenceId]
    });
    await advanceRecurrenceIfApplicable(db, row);
    return { handled: true, status: "skipped", reason: "insufficient_credits" };
  }

  // Parse template parameters
  let parsedParams = [];
  if (row.template_params) {
    try {
      parsedParams = typeof row.template_params === "string" ? JSON.parse(row.template_params) : row.template_params;
    } catch (_) {
      parsedParams = [];
    }
  }

  // 6. Dispatch via single authoritative WhatsApp messaging pipeline
  const referenceId = `occ_${occurrenceId}`;
  const contactPerson = caseContactPerson || "Client";

  let caseToken = "verify";
  if (row.case_id) {
    const tokenRes = await db.execute({
      sql: "SELECT token FROM secure_tokens WHERE case_id = ? ORDER BY expires_at DESC LIMIT 1",
      args: [row.case_id]
    });
    if (tokenRes.rows?.[0]?.token) {
      caseToken = tokenRes.rows[0].token;
    }
  }

  const pipeRes = await executeWhatsAppMessagingPipeline(
    db,
    user,
    cleanedPhone,
    row.template_name,
    contactPerson,
    caseToken,
    env,
    referenceId,
    parsedParams,
    row.contact_id,
    row.case_id
  );

  // 7. Settle Terminal Status
  if (pipeRes?.success) {
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'completed', provider_message_id = ?, executed_at = datetime('now') WHERE id = ?",
      args: [pipeRes.providerMsgId || null, occurrenceId]
    });
    await advanceRecurrenceIfApplicable(db, row);
    return { handled: true, status: "completed", providerMsgId: pipeRes.providerMsgId };
  }

  // Active consumer in-flight duplicate: yield and do not overwrite occurrence to unknown
  if (pipeRes?.inFlight) {
    return { handled: true, status: "in_flight_duplicate", inFlight: true };
  }

  if (pipeRes?.error === "WHATSAPP_TIMEOUT" || pipeRes?.ambiguous) {
    // Ambiguous network outcome: strictly set to unknown, do NOT auto-retry
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'unknown', last_error = ?, executed_at = datetime('now') WHERE id = ?",
      args: [pipeRes.message || "Provider timeout / ambiguous in-flight dispatch", occurrenceId]
    });
    await advanceRecurrenceIfApplicable(db, row);
    return { handled: true, status: "unknown", error: pipeRes?.error || "WHATSAPP_TIMEOUT" };
  }

  if (pipeRes?.insufficientCredits) {
    await db.execute({
      sql: "UPDATE scheduled_occurrences SET operational_status = 'skipped', skip_reason = 'insufficient_credits', executed_at = datetime('now') WHERE id = ?",
      args: [occurrenceId]
    });
    await advanceRecurrenceIfApplicable(db, row);
    return { handled: true, status: "skipped", reason: "insufficient_credits" };
  }

  // Explicit provider failure
  await db.execute({
    sql: "UPDATE scheduled_occurrences SET operational_status = 'failed', last_error = ?, executed_at = datetime('now') WHERE id = ?",
    args: [pipeRes?.message || "WhatsApp message delivery failed", occurrenceId]
  });
  await advanceRecurrenceIfApplicable(db, row);
  return { handled: true, status: "failed", error: pipeRes?.error || "WHATSAPP_FAILED" };
}

/**
 * Recurrence Advancement
 * Calculates the next occurrence preserving local wall-clock time in the schedule's timezone,
 * and inserts the single next occurrence (strict 1-step rolling horizon).
 */
async function advanceRecurrenceIfApplicable(db, scheduleRow) {
  if (scheduleRow.schedule_type === "one_off" || !scheduleRow.recurrence_interval) {
    // One-off schedule completes once occurrence finishes
    await db.execute({
      sql: "UPDATE schedules SET status = 'completed', next_run_utc = NULL WHERE id = ?",
      args: [scheduleRow.schedule_id]
    });
    return null;
  }

  // Recurring schedule: compute next UTC time preserving local wall-clock hour/minute
  const nextUtc = calculateNextRunUtc(
    scheduleRow.scheduled_for_utc,
    scheduleRow.recurrence_interval,
    scheduleRow.timezone || "UTC"
  );

  if (!nextUtc) {
    await db.execute({
      sql: "UPDATE schedules SET status = 'completed', next_run_utc = NULL WHERE id = ?",
      args: [scheduleRow.schedule_id]
    });
    return null;
  }

  // Update schedule next_run_utc
  await db.execute({
    sql: "UPDATE schedules SET next_run_utc = ? WHERE id = ?",
    args: [nextUtc, scheduleRow.schedule_id]
  });

  // Insert next single occurrence with deterministic key
  const nextOccId = `occ_${crypto.randomUUID()}`;
  const nextKey = `${scheduleRow.schedule_id}_${nextUtc}`;

  await db.execute({
    sql: `
      INSERT OR IGNORE INTO scheduled_occurrences (
        id, schedule_id, occurrence_key, scheduled_for_utc, operational_status
      ) VALUES (?, ?, ?, ?, 'pending')
    `,
    args: [nextOccId, scheduleRow.schedule_id, nextKey, nextUtc]
  });

  return nextOccId;
}

/**
 * Cloudflare Queue batch handler
 */
export async function handleQueueBatch(batch, env, ctx, db) {
  for (const message of batch.messages) {
    const { occurrenceId } = message.body || {};
    if (occurrenceId) {
      try {
        await processScheduledOccurrence(occurrenceId, env, db);
      } catch (err) {
        console.error(`[QUEUE CONSUMER] Error processing occurrence ${occurrenceId}:`, err);
      }
    }
    // Always acknowledge message to prevent infinite retry loop
    message.ack();
  }
}
