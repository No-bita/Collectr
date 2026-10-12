import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import { handleCreateSchedule } from "../src/api/schedules.js";

// Tests for https://github.com/No-bita/Collectr/issues/22
// The explicit-contactId lookup in handleCreateSchedule must scope contacts by
// firm_id (like every other contact-by-id lookup since #14), not user_id.

function createFirmMockDb({ contacts = [] } = {}) {
  const inserted = { schedules: [], occurrences: [], activities: [] };
  const execute = async (query) => {
    const sql = typeof query === "string" ? query : query.sql;
    const args = typeof query === "string" ? [] : query.args || [];
    const norm = sql.replace(/\s+/g, " ").trim();

    if (norm.startsWith("SELECT id, name, phone_number, email FROM contacts WHERE id = ? AND firm_id = ?")) {
      const [id, firmId] = args;
      const c = contacts.find((x) => x.id === id && x.firm_id === firmId);
      return { rows: c ? [c] : [] };
    }
    if (norm.startsWith("INSERT INTO schedules")) {
      inserted.schedules.push(args);
      return { rows: [], changes: 1 };
    }
    if (norm.startsWith("INSERT INTO scheduled_occurrences")) {
      inserted.occurrences.push(args);
      return { rows: [], changes: 1 };
    }
    if (norm.startsWith("INSERT INTO activities")) {
      inserted.activities.push(args);
      return { rows: [], changes: 1 };
    }
    return { rows: [] };
  };
  return {
    execute,
    batch: async (stmts) => Promise.all(stmts.map(execute)),
    inserted,
  };
}

function createCtx(db, { userId = "usr_staff", firmId = "firm_a", body } = {}) {
  return {
    get: (k) => (k === "user" ? { id: userId, username: "Staff" } : k === "firmId" ? firmId : null),
    req: { json: async () => body },
    env: { DB: db },
    json: (data, status = 200) => ({ status, data }),
  };
}

const scheduleBody = {
  contactId: "cnt_colleague",
  messageBody: "Hello from the firm",
  channel: "whatsapp",
  timezone: "Asia/Kolkata",
  scheduledFor: "2026-10-20T10:00:00",
};

test("Issue #22: POST /api/schedules contact lookup is firm-scoped, not user-scoped", async (t) => {
  await t.test("contact created by a different user in the same firm resolves and the schedule is created", async () => {
    const db = createFirmMockDb({
      contacts: [{ id: "cnt_colleague", user_id: "usr_owner", firm_id: "firm_a", name: "Colleague Contact", phone_number: "919876543210", email: null }],
    });
    const res = await handleCreateSchedule(createCtx(db, { body: scheduleBody }));
    assert.equal(res.status, 201, "same-firm contact created by a colleague must resolve");
    assert.equal(res.data.success, true);
    assert.equal(res.data.schedule.contactId, "cnt_colleague");
    assert.equal(db.inserted.schedules.length, 1);
    assert.equal(db.inserted.occurrences.length, 1);
  });

  await t.test("contact from a different firm returns 404", async () => {
    const db = createFirmMockDb({
      contacts: [{ id: "cnt_colleague", user_id: "usr_staff", firm_id: "firm_b", name: "Other Firm", phone_number: "919876543210", email: null }],
    });
    const res = await handleCreateSchedule(createCtx(db, { body: scheduleBody }));
    assert.equal(res.status, 404);
    assert.equal(res.data.error, "Contact not found.");
    assert.equal(db.inserted.schedules.length, 0, "no schedule may be created for a cross-firm contact");
  });

  await t.test("unknown contact id still returns 404", async () => {
    const db = createFirmMockDb({ contacts: [] });
    const res = await handleCreateSchedule(createCtx(db, { body: scheduleBody }));
    assert.equal(res.status, 404);
    assert.equal(res.data.error, "Contact not found.");
  });
});
