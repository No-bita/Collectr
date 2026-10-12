import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import { processScheduledOccurrence } from "../src/scheduler/consumer.js";

// Regression tests for https://github.com/No-bita/Collectr/issues/16
// A redelivered occurrence that already reached a terminal state must never be
// overwritten by the schedule/case/request guards.

function createConsumerMockDb({ occurrences = [], schedules = [], requests = [], loanCases = [], users = [] }) {
  const writes = [];
  const execute = async (query) => {
    const sql = typeof query === "string" ? query : query.sql;
    const args = typeof query === "string" ? [] : query.args || [];
    const norm = sql.replace(/\s+/g, " ").trim();

    if (norm.includes("FROM scheduled_occurrences o") && norm.includes("JOIN schedules s")) {
      const occ = occurrences.find((o) => o.id === args[0]);
      if (!occ) return { rows: [] };
      const sch = schedules.find((s) => s.id === occ.schedule_id);
      if (!sch) return { rows: [] };
      return {
        rows: [{
          ...occ,
          user_id: sch.user_id,
          contact_id: sch.contact_id || null,
          case_id: sch.case_id || null,
          request_id: sch.request_id || null,
          schedule_channel: sch.channel || "whatsapp",
          template_id: sch.template_id || null,
          message_body: sch.message_body || null,
          payload_snapshot: null,
          schedule_type: sch.schedule_type || "one_off",
          recurrence_interval: null,
          timezone: sch.timezone || "Asia/Kolkata",
          schedule_status: sch.status,
          contact_name: "Test Contact",
          contact_phone: "919876543210",
          contact_email: null,
        }],
      };
    }
    if (norm.startsWith("SELECT status FROM requests WHERE id = ?")) {
      const r = requests.find((x) => x.id === args[0]);
      return { rows: r ? [{ status: r.status }] : [] };
    }
    if (norm.startsWith("SELECT status FROM loan_cases WHERE id = ?")) {
      const r = loanCases.find((x) => x.id === args[0]);
      return { rows: r ? [{ status: r.status }] : [] };
    }
    if (norm.startsWith("SELECT id, username, credit_balance FROM users WHERE id = ?")) {
      const u = users.find((x) => x.id === args[0]);
      return { rows: u ? [u] : [] };
    }
    if (norm.startsWith("UPDATE scheduled_occurrences")) {
      const occId = args[args.length - 1];
      const occ = occurrences.find((o) => o.id === occId);
      writes.push({ sql: norm, args });
      if (occ) {
        if (norm.includes("operational_status = 'skipped'")) {
          occ.operational_status = "skipped";
          const m = norm.match(/skip_reason = '([^']+)'/);
          occ.skip_reason = m ? m[1] : args[0];
        }
        occ.executed_at = "rewritten";
      }
      return { rows: [], changes: occ ? 1 : 0 };
    }
    if (norm.startsWith("UPDATE schedules SET status = 'completed'")) {
      writes.push({ sql: norm, args });
      return { rows: [], changes: 1 };
    }
    return { rows: [] };
  };
  return { execute, batch: async (stmts) => Promise.all(stmts.map(execute)), writes };
}

const baseSchedule = {
  id: "sch_1",
  user_id: "usr_1",
  contact_id: "cnt_1",
  request_id: "req_1",
  status: "active",
};

const baseOccurrence = {
  id: "occ_1",
  schedule_id: "sch_1",
  occurrence_key: "key_1",
  scheduled_for_utc: "2026-10-12 10:00:00",
  operational_status: "completed",
  occ_channel: "whatsapp",
  recipient_phone: "919876543210",
  recipient_email: null,
  executed_at: "2026-10-12 10:00:05",
};

test("Issue #16: redelivered terminal occurrences are never overwritten by terminal-state guards", async (t) => {
  await t.test("completed occurrence + terminal request returns alreadyDone and is not rewritten to skipped", async () => {
    const occurrences = [{ ...baseOccurrence }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule }],
      requests: [{ id: "req_1", status: "completed" }],
    });
    const res = await processScheduledOccurrence("occ_1", {}, db);
    assert.equal(res.handled, true);
    assert.equal(res.status, "completed");
    assert.equal(res.alreadyDone, true);
    assert.equal(occurrences[0].operational_status, "completed", "must stay completed, not skipped");
    assert.equal(occurrences[0].skip_reason, undefined);
    assert.equal(occurrences[0].executed_at, "2026-10-12 10:00:05", "executed_at must not move");
    assert.equal(db.writes.length, 0, "no writes at all for an already-terminal occurrence");
  });

  await t.test("completed occurrence + closed loan case is not rewritten to skipped", async () => {
    const occurrences = [{ ...baseOccurrence }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule, request_id: null, case_id: "case_1" }],
      loanCases: [{ id: "case_1", status: "closed" }],
    });
    const res = await processScheduledOccurrence("occ_1", {}, db);
    assert.equal(res.alreadyDone, true);
    assert.equal(res.status, "completed");
    assert.equal(occurrences[0].operational_status, "completed");
    assert.equal(db.writes.length, 0);
  });

  await t.test("completed occurrence + cancelled schedule is not rewritten to skipped", async () => {
    const occurrences = [{ ...baseOccurrence }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule, status: "cancelled" }],
      requests: [{ id: "req_1", status: "cancelled" }],
    });
    const res = await processScheduledOccurrence("occ_1", {}, db);
    assert.equal(res.alreadyDone, true);
    assert.equal(res.status, "completed");
    assert.equal(occurrences[0].operational_status, "completed");
    assert.equal(db.writes.length, 0);
  });

  await t.test("skipped occurrence + terminal request is left untouched", async () => {
    const occurrences = [{ ...baseOccurrence, operational_status: "skipped", skip_reason: "insufficient_credits" }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule }],
      requests: [{ id: "req_1", status: "closed" }],
    });
    const res = await processScheduledOccurrence("occ_1", {}, db);
    assert.equal(res.alreadyDone, true);
    assert.equal(res.status, "skipped");
    assert.equal(occurrences[0].skip_reason, "insufficient_credits", "original skip reason must be preserved");
    assert.equal(db.writes.length, 0);
  });

  await t.test("control: pending occurrence + terminal request is still skipped as request_completed", async () => {
    const occurrences = [{ ...baseOccurrence, operational_status: "claimed", executed_at: undefined }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule }],
      requests: [{ id: "req_1", status: "completed" }],
    });
    const res = await processScheduledOccurrence("occ_1", {}, db);
    assert.equal(res.handled, true);
    assert.equal(res.status, "skipped");
    assert.equal(res.reason, "request_completed");
    assert.equal(occurrences[0].operational_status, "skipped");
    assert.equal(occurrences[0].skip_reason, "request_completed");
  });

  await t.test("control: pending occurrence + active request is not affected by the reordered guard", async () => {
    const occurrences = [{ ...baseOccurrence, operational_status: "claimed", executed_at: undefined }];
    const db = createConsumerMockDb({
      occurrences,
      schedules: [{ ...baseSchedule }],
      requests: [{ id: "req_1", status: "open" }],
      users: [{ id: "usr_1", username: "Test", credit_balance: 0 }],
    });
    const res = await processScheduledOccurrence("occ_1", { ENVIRONMENT: "development" }, db);
    assert.equal(res.status, "skipped");
    assert.equal(res.reason, "insufficient_credits", "flows past the request guard into the credit check as before");
  });
});
