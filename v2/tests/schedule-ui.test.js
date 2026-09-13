import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleBulkImportCases, executeWhatsAppMessagingPipeline } from '../src/api/cases.js';
import { processScheduledOccurrence } from '../src/scheduler/consumer.js';
import { scanAndClaimDueOccurrences } from '../src/scheduler/scanner.js';
import { toSqliteUtc, isValidTimezone, parseScheduledForToUtc } from '../src/scheduler/time.js';

const rootDir = path.resolve(process.cwd());

test('Scheduling UI & Bulk Import Scheduling Architecture Tests', async (t) => {
  const htmlPath = path.join(rootDir, 'public', 'dashboard.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
  const js = fs.readFileSync(jsPath, 'utf8');

  await t.test('1. Wizard Modal Compact Scheduling UI Elements in dashboard.html', () => {
    // Clock trigger button with accessible label
    assert.ok(html.includes('id="btnOpenSchedulePopup"'), 'btnOpenSchedulePopup clock action must exist');
    assert.ok(html.includes('aria-label="Schedule message"'), 'btnOpenSchedulePopup must have aria-label="Schedule message"');
    assert.ok(html.includes('title="Schedule message"'), 'btnOpenSchedulePopup must have title="Schedule message"');
    
    // Scheduled chip and clear button
    assert.ok(html.includes('id="wizardScheduleChip"'), 'wizardScheduleChip must exist');
    assert.ok(html.includes('id="wizardScheduleChipText"'), 'wizardScheduleChipText must exist');
    assert.ok(html.includes('id="btnClearWizardSchedule"'), 'btnClearWizardSchedule must exist');

    // Compact popover panel inside wizard modal
    assert.ok(html.includes('id="wizardSchedulePopup"'), 'wizardSchedulePopup popover must exist');
    assert.ok(html.includes('id="scheduleDatetime"'), 'scheduleDatetime input (datetime-local) must exist');
    assert.ok(html.includes('id="btnCancelWizardSchedule"'), 'btnCancelWizardSchedule must exist');
    assert.ok(html.includes('id="btnSetWizardSchedule"'), 'btnSetWizardSchedule must exist');

    // Ensure recurrence dropdown was removed
    assert.ok(!html.includes('id="scheduleRecurrence"'), 'scheduleRecurrence select dropdown must not exist');

    // Ensure old bloated permanent section was removed
    assert.ok(!html.includes('id="scheduleDeliveryGroup"'), 'Old permanent scheduleDeliveryGroup must not exist');
  });

  await t.test('2. Bulk Import Modal Compact Scheduling UI Elements in dashboard.html', () => {
    // Clock trigger button next to WhatsApp send checkbox
    assert.ok(html.includes('id="btnBulkOpenSchedule"'), 'btnBulkOpenSchedule clock action must exist');
    assert.ok(html.includes('id="bulkScheduleChip"'), 'bulkScheduleChip must exist');
    assert.ok(html.includes('id="bulkScheduleChipText"'), 'bulkScheduleChipText must exist');
    assert.ok(html.includes('id="btnBulkClearSchedule"'), 'btnBulkClearSchedule must exist');

    // Compact popover panel inside bulk modal
    assert.ok(html.includes('id="bulkSchedulePopup"'), 'bulkSchedulePopup popover must exist');
    assert.ok(html.includes('id="bulkScheduleDatetime"'), 'bulkScheduleDatetime input must exist');
    assert.ok(!html.includes('id="bulkScheduleRecurrence"'), 'bulkScheduleRecurrence select must not exist');
    assert.ok(html.includes('id="btnCancelBulkSchedule"'), 'btnCancelBulkSchedule must exist');
    assert.ok(html.includes('id="btnSetBulkSchedule"'), 'btnSetBulkSchedule must exist');
  });

  await t.test('3. CSS Styling Rules in dashboard.css for Popover & Chips', () => {
    assert.ok(css.includes('.btn-schedule-clock'), '.btn-schedule-clock rule must exist');
    assert.ok(css.includes('.schedule-popover-panel'), '.schedule-popover-panel rule must exist');
    assert.ok(css.includes('.schedule-chip'), '.schedule-chip rule must exist');
    assert.ok(css.includes('.schedule-popover-header'), '.schedule-popover-header rule must exist');
  });

  await t.test('4. JavaScript Popover Engine & Button Label Sync in app.js', () => {
    assert.ok(js.includes('let wizardScheduleState = null;'), 'wizardScheduleState must be tracked');
    assert.ok(js.includes('let bulkScheduleState = null;'), 'bulkScheduleState must be tracked');
    assert.ok(js.includes('function openWizardSchedulePopup'), 'openWizardSchedulePopup must exist');
    assert.ok(js.includes('function setWizardSchedule'), 'setWizardSchedule must exist');
    assert.ok(js.includes('function clearWizardSchedule'), 'clearWizardSchedule must exist');
    assert.ok(js.includes('function openBulkSchedulePopup'), 'openBulkSchedulePopup must exist');
    assert.ok(js.includes('function setBulkSchedule'), 'setBulkSchedule must exist');
    assert.ok(js.includes('function clearBulkSchedule'), 'clearBulkSchedule must exist');
    assert.ok(js.includes('function updateBulkSubmitButtonLabel'), 'updateBulkSubmitButtonLabel must exist');
    assert.ok(js.includes('Schedule Outreach for ${validCount} Client'), 'Dynamic schedule button label must use validCount');
  });

  await t.test('5. Backend Bulk Import Scheduling Execution & Invariants', async (st) => {
    function createMockDb() {
      const records = {
        users: [
          { id: 'usr_test_1', username: 'Test Agent', credit_balance: 900 }
        ],
        contacts: [],
        loan_cases: [],
        secure_tokens: [],
        required_documents: [],
        schedules: [],
        scheduled_occurrences: [],
        case_timeline: [],
        whatsapp_messages: [],
        credit_reservations: [],
        credit_transactions: [],
        message_templates: []
      };

      const executeFn = async (query) => {
        const sql = typeof query === 'string' ? query : query.sql;
        const args = typeof query === 'string' ? [] : (query.args || []);
        const norm = sql.replace(/\s+/g, ' ').trim();

        if (norm.startsWith('SELECT id, contact_person FROM contacts')) {
          const [userId, phone] = args;
          const c = records.contacts.find(x => x.phone_number === phone && x.user_id === userId);
          return { rows: c ? [c] : [] };
        }
        if (norm.startsWith('INSERT INTO contacts')) {
          const [id, user_id, contact_person, phone_number] = args;
          records.contacts.push({ id, user_id, contact_person, phone_number });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO loan_cases')) {
          const [id, contact_id, user_id, contact_person, phone_number, loan_product, template_name, amount_required, status, whatsapp_delivery_status] = args;
          records.loan_cases.push({
            id, contact_id, user_id, contact_person, phone_number,
            loan_product, template_name, amount_required, status,
            whatsapp_delivery_status: whatsapp_delivery_status || 'pending'
          });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO secure_tokens')) {
          const [token, case_id, expires_at] = args;
          records.secure_tokens.push({ token, case_id, expires_at });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO required_documents')) {
          const [id, case_id, document_type, label] = args;
          records.required_documents.push({ id, case_id, document_type, label });
          return { rows: [] };
        }
        if (norm.startsWith('UPDATE loan_cases SET whatsapp_delivery_status =')) {
          const [case_id] = args;
          const item = records.loan_cases.find(x => x.id === case_id);
          if (item) item.whatsapp_delivery_status = norm.includes("'sent'") ? 'sent' : (norm.includes("'unknown'") ? 'unknown' : 'scheduled');
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('INSERT INTO schedules')) {
          const [id, user_id, case_id, contact_id, phone_number, template_name, template_params, schedule_type, recurrence_interval, timezone, scheduled_for_utc] = args;
          records.schedules.push({
            id, user_id, case_id, contact_id, phone_number, template_name,
            template_params, schedule_type, recurrence_interval, timezone,
            status: 'active', next_run_utc: scheduled_for_utc
          });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO scheduled_occurrences')) {
          const [id, schedule_id, occurrence_key, scheduled_for_utc] = args;
          records.scheduled_occurrences.push({
            id, schedule_id, occurrence_key, scheduled_for_utc, operational_status: 'pending',
            claimed_at: null, attempts: 0
          });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO case_timeline')) {
          records.case_timeline.push({ sql, args });
          return { rows: [] };
        }
        if (norm.startsWith("UPDATE scheduled_occurrences SET operational_status = 'claimed'")) {
          const occId = args[0];
          const occ = records.scheduled_occurrences.find(o => o.id === occId);
          if (occ) {
            const now = Date.now();
            const tenMinsAgo = now - 10 * 60 * 1000;
            const isPending = occ.operational_status === 'pending';
            const isStale = occ.operational_status === 'claimed' && occ.claimed_at && (new Date(occ.claimed_at).getTime() < tenMinsAgo);
            if (isPending || isStale) {
              occ.operational_status = 'claimed';
              occ.claimed_at = new Date().toISOString();
              occ.attempts = (occ.attempts || 0) + 1;
              return { rows: [{ id: occ.id }], changes: 1 };
            }
          }
          return { rows: [], changes: 0 };
        }
        if (norm.includes("FROM scheduled_occurrences") && norm.includes("ORDER BY scheduled_for_utc ASC LIMIT")) {
          const limit = args[0] || 50;
          const now = Date.now();
          const tenMinsAgo = now - 10 * 60 * 1000;
          const matches = records.scheduled_occurrences.filter(o => {
            if (o.operational_status === "pending") {
              const schedTime = new Date(o.scheduled_for_utc.replace(" ", "T") + (o.scheduled_for_utc.endsWith("Z") ? "" : "Z")).getTime();
              return schedTime <= now + 1000;
            }
            if (o.operational_status === "claimed" && o.claimed_at) {
              const claimTime = new Date(o.claimed_at).getTime();
              return claimTime < tenMinsAgo;
            }
            return false;
          }).slice(0, limit);
          return { rows: matches };
        }
        if (norm.includes("FROM scheduled_occurrences o JOIN schedules s ON o.schedule_id = s.id WHERE o.id = ?")) {
          const occId = args[0];
          const occ = records.scheduled_occurrences.find(o => o.id === occId);
          if (!occ) return { rows: [] };
          const sch = records.schedules.find(s => s.id === occ.schedule_id);
          if (!sch) return { rows: [] };
          return {
            rows: [{
              ...occ,
              user_id: sch.user_id,
              case_id: sch.case_id,
              contact_id: sch.contact_id,
              phone_number: sch.phone_number,
              template_name: sch.template_name,
              template_params: sch.template_params,
              schedule_type: sch.schedule_type,
              recurrence_interval: sch.recurrence_interval,
              timezone: sch.timezone,
              schedule_status: sch.status
            }]
          };
        }
        if (norm.startsWith("SELECT id, status, contact_person, phone_number FROM loan_cases WHERE id = ?")) {
          const c = records.loan_cases.find(x => x.id === args[0]);
          return { rows: c ? [c] : [] };
        }
        if (norm.startsWith("SELECT token FROM secure_tokens WHERE case_id = ?")) {
          const t = records.secure_tokens.find(x => x.case_id === args[0]);
          return { rows: t ? [{ token: t.token }] : [] };
        }
        if (norm.startsWith("SELECT id, username, credit_balance FROM users WHERE id = ?") || norm.startsWith("SELECT credit_balance FROM users WHERE id = ?")) {
          const u = records.users.find(x => x.id === args[0]);
          return { rows: u ? [u] : [] };
        }
        if (norm.startsWith("UPDATE users SET credit_balance = ? WHERE id = ?")) {
          const [newBal, uId] = args;
          const u = records.users.find(x => x.id === uId);
          if (u) u.credit_balance = newBal;
          return { rows: [], changes: 1 };
        }
        if (norm.includes("FROM whatsapp_messages WHERE user_id = ? AND idempotency_key = ?")) {
          const [userId, idempKey] = args;
          const msg = records.whatsapp_messages.find(m => m.user_id === userId && m.idempotency_key === idempKey);
          if (!msg) return { rows: [] };
          const ageSeconds = msg.age_seconds !== undefined
            ? msg.age_seconds
            : (msg.created_at ? Math.max(0, Math.floor((Date.now() - new Date(msg.created_at).getTime()) / 1000)) : 0);
          return {
            rows: [{
              status: msg.status,
              provider_message_id: msg.provider_message_id || null,
              created_at: msg.created_at,
              age_seconds: ageSeconds
            }]
          };
        }
        if (norm.startsWith("INSERT INTO whatsapp_messages")) {
          const [id, user_id, idempotency_key] = args;
          const status = norm.includes("'SENDING'") ? 'SENDING' : (args[3] || 'SENDING');
          const existing = records.whatsapp_messages.find(m => m.user_id === user_id && m.idempotency_key === idempotency_key);
          if (existing) {
            return { rows: [], changes: 0 };
          } else {
            records.whatsapp_messages.push({
              id, user_id, idempotency_key, status, provider_message_id: null, created_at: new Date().toISOString()
            });
            return { rows: [{ id }], changes: 1 };
          }
        }
        if (norm.startsWith("UPDATE whatsapp_messages SET status = 'SENT'")) {
          const [providerMsgId, msgId] = args;
          const m = records.whatsapp_messages.find(x => x.id === msgId);
          if (m) {
            m.status = 'SENT';
            m.provider_message_id = providerMsgId;
          }
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith("UPDATE whatsapp_messages SET status = 'UNKNOWN'")) {
          const [userId, idempKey] = args;
          const m = records.whatsapp_messages.find(x => x.user_id === userId && x.idempotency_key === idempKey);
          if (m) m.status = 'UNKNOWN';
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith("UPDATE scheduled_occurrences SET operational_status =")) {
          const lastArg = args[args.length - 1];
          const occ = records.scheduled_occurrences.find(o => o.id === lastArg);
          if (occ) {
            if (norm.includes("operational_status = 'completed'")) {
              occ.operational_status = 'completed';
              occ.provider_message_id = args[0];
            } else if (norm.includes("operational_status = 'unknown'")) {
              occ.operational_status = 'unknown';
              occ.last_error = args[0];
            } else if (norm.includes("operational_status = 'skipped'")) {
              occ.operational_status = 'skipped';
              occ.skip_reason = args[0] || 'insufficient_credits';
            } else if (norm.includes("operational_status = 'failed'")) {
              occ.operational_status = 'failed';
              occ.last_error = args[0];
            }
            occ.executed_at = new Date().toISOString();
            return { rows: [{ id: occ.id }], changes: 1 };
          }
          return { rows: [], changes: 0 };
        }
        if (norm.startsWith("UPDATE schedules SET status = 'completed'")) {
          const sId = args[0];
          const sch = records.schedules.find(s => s.id === sId);
          if (sch) sch.status = 'completed';
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM scheduled_occurrences')) {
          const [caseId] = args;
          const caseScheduleIds = records.schedules.filter(s => s.case_id === caseId).map(s => s.id);
          records.scheduled_occurrences = records.scheduled_occurrences.filter(o => !caseScheduleIds.includes(o.schedule_id));
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM schedules')) {
          const [caseId] = args;
          records.schedules = records.schedules.filter(s => s.case_id !== caseId);
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM case_timeline')) {
          const [caseId] = args;
          records.case_timeline = records.case_timeline.filter(t => !t.args.includes(caseId));
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM required_documents')) {
          const [caseId] = args;
          records.required_documents = records.required_documents.filter(d => d.case_id !== caseId);
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM secure_tokens')) {
          const [caseId] = args;
          records.secure_tokens = records.secure_tokens.filter(t => t.case_id !== caseId);
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith('DELETE FROM loan_cases')) {
          const [caseId] = args;
          records.loan_cases = records.loan_cases.filter(c => c.id !== caseId);
          return { rows: [], changes: 1 };
        }
        return { rows: [] };
      };

      const batchFn = async (statements) => {
        const results = [];
        for (const s of statements) {
          results.push(await executeFn(s));
        }
        return results;
      };

      return {
        records,
        execute: executeFn,
        batch: batchFn
      };
    }

    await st.test('5.1 Immediate bulk import remains unchanged when no schedule provided', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Arun Gupta', phoneNumber: '9876543210' },
          { contactPerson: 'Beena Shah', phoneNumber: '9876543211' }
        ],
        sendWhatsApp: false // immediate import without whatsapp
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.importedCount, 2);
      assert.equal(res.data.failedCount, 0);
      assert.equal(res.data.scheduled, false);
      assert.equal(mockDb.records.schedules.length, 0, 'No schedule records created for immediate import');
      assert.equal(mockDb.records.scheduled_occurrences.length, 0, 'No occurrences created for immediate import');
    });

    await st.test('5.2 One-off bulk scheduling creates schedule and exactly 1 initial occurrence per eligible case', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const futureDate = new Date(Date.now() + 2 * 3600 * 1000);
      const reqBody = {
        clients: [
          { contactPerson: 'Rohan Mehra', phoneNumber: '9876543210', templateParams: ['Rohan Mehra', '₹50,000'] },
          { contactPerson: 'Kavita Sen', phoneNumber: '9876543211', templateParams: ['Kavita Sen', '₹75,000'] }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1',
        schedule: {
          scheduledFor: futureDate.toISOString(),
          scheduleType: 'one_off',
          timezone: 'Asia/Kolkata'
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.success, true);
      assert.equal(res.data.importedCount, 2);
      assert.equal(res.data.scheduled, true);
      assert.ok(res.data.nextRunUtc);

      // Invariant checks
      assert.equal(mockDb.records.loan_cases.length, 2);
      assert.equal(mockDb.records.schedules.length, 2);
      assert.equal(mockDb.records.scheduled_occurrences.length, 2);

      // Both cases marked scheduled
      assert.ok(mockDb.records.loan_cases.every(c => c.whatsapp_delivery_status === 'scheduled'));

      // recurrence_interval must be null for one_off
      assert.ok(mockDb.records.schedules.every(s => s.schedule_type === 'one_off' && s.recurrence_interval === null));

      // Each schedule has exactly 1 initial pending occurrence
      for (const sched of mockDb.records.schedules) {
        const occs = mockDb.records.scheduled_occurrences.filter(o => o.schedule_id === sched.id);
        assert.equal(occs.length, 1, `Schedule ${sched.id} must have exactly 1 occurrence`);
        assert.equal(occs[0].operational_status, 'pending');
      }

      // Template parameters preserved
      const sched1 = mockDb.records.schedules.find(s => s.phone_number === '919876543210');
      assert.ok(sched1, 'Schedule for 919876543210 must exist');
      assert.deepEqual(JSON.parse(sched1.template_params), ['Rohan Mehra', '₹50,000']);

      // Timezone preserved
      assert.equal(sched1.timezone, 'Asia/Kolkata');
    });

    await st.test('5.3 One-off bulk scheduling creates ONLY the initial occurrence', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
      const reqBody = {
        clients: [
          { contactPerson: 'Scheduled Client', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1',
        schedule: {
          scheduledFor: futureDate.toISOString(),
          scheduleType: 'one_off',
          timezone: 'Asia/Kolkata'
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.data.importedCount, 1);
      assert.equal(mockDb.records.schedules.length, 1);
      assert.equal(mockDb.records.schedules[0].schedule_type, 'one_off');
      assert.equal(mockDb.records.schedules[0].recurrence_interval, null);
      assert.equal(mockDb.records.scheduled_occurrences.length, 1, 'MUST ONLY create the first initial occurrence');
    });

    await st.test('5.4 Invalid rows are not scheduled & partial failures are recorded safely', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const futureDate = new Date(Date.now() + 2 * 3600 * 1000);
      const reqBody = {
        clients: [
          { contactPerson: 'Valid Client 1', phoneNumber: '9876543210' },
          { contactPerson: 'Invalid Client 2', phoneNumber: '123' }, // invalid phone
          { contactPerson: 'Valid Client 3', phoneNumber: '+91 98765 43211' }
        ],
        sendWhatsApp: true,
        schedule: {
          scheduledFor: futureDate.toISOString(),
          scheduleType: 'one_off',
          recurrenceInterval: 'one_off'
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.data.total, 3);
      assert.equal(res.data.importedCount, 2);
      assert.equal(res.data.failedCount, 1);

      // Invariant: Exactly 2 cases, 2 schedules, 2 occurrences created; invalid row got NONE
      assert.equal(mockDb.records.loan_cases.length, 2);
      assert.equal(mockDb.records.schedules.length, 2);
      assert.equal(mockDb.records.scheduled_occurrences.length, 2);

      const invalidResult = res.data.results.find(r => r.name === 'Invalid Client 2');
      assert.equal(invalidResult.success, false);
      assert.ok(invalidResult.error);
    });

    await st.test('5.5 Timezone conversion helper tests', () => {
      assert.equal(isValidTimezone('Asia/Kolkata'), true);
      assert.equal(isValidTimezone('America/New_York'), true);
      assert.equal(isValidTimezone('Invalid/Zone'), false);

      const d = new Date('2026-09-15T10:30:00.000Z');
      const utcStr = toSqliteUtc(d);
      assert.equal(utcStr, '2026-09-15 10:30:00');
    });

    await st.test('5.6 Per-row failure atomicity ensures no orphaned case or schedule records', async () => {
      const mockDb = createMockDb();
      let failOccurrencesFor = null;

      mockDb.batch = async (statements) => {
        if (failOccurrencesFor && statements.some(s => (typeof s === 'string' ? s : s.sql).includes('INSERT INTO scheduled_occurrences'))) {
          throw new Error('Simulated D1 batch failure on occurrence insert');
        }
        for (const s of statements) await mockDb.execute(s);
        return [];
      };

      const mockEnv = { DB: mockDb };
      failOccurrencesFor = true;

      const reqBody = {
        clients: [
          { contactPerson: 'Atomic Fail Client', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        schedule: {
          scheduledFor: '2026-09-14T10:00',
          timezone: 'Asia/Kolkata'
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.data.failedCount, 1);
      assert.equal(res.data.importedCount, 0);

      // Invariant: Cleanup purged partial loan_cases, schedules, tokens, timeline
      assert.equal(mockDb.records.loan_cases.length, 0, 'No orphaned case record must remain on row failure');
      assert.equal(mockDb.records.schedules.length, 0, 'No orphaned schedule record must remain on row failure');
      assert.equal(mockDb.records.scheduled_occurrences.length, 0, 'No orphaned occurrence must exist');
    });

    await st.test('5.7 parseScheduledForToUtc strictly converts datetime-local in IANA timezone', () => {
      // 10:00 AM IST in Asia/Kolkata (UTC+5:30) is 04:30 AM UTC
      const istResult = parseScheduledForToUtc('2026-09-14T10:00', 'Asia/Kolkata');
      assert.equal(istResult, '2026-09-14 04:30:00');
      assert.notEqual(istResult, '2026-09-14 10:00:00', 'Must not treat datetime-local string as UTC');

      // ISO timestamp with explicit Z preserves instant
      const isoResult = parseScheduledForToUtc('2026-09-14T04:30:00.000Z', 'Asia/Kolkata');
      assert.equal(isoResult, '2026-09-14 04:30:00');
    });

    await st.test('5.8 One-off schedule payload semantics: recurrenceInterval must never be stored as "one_off"', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'One Off Client', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        schedule: {
          scheduleType: 'one_off',
          scheduledFor: '2026-09-14T10:00',
          timezone: 'Asia/Kolkata',
          recurrenceInterval: 'one_off' // Client mistakenly supplied one_off
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.importedCount, 1);
      assert.equal(mockDb.records.schedules.length, 1);

      const savedSchedule = mockDb.records.schedules[0];
      assert.equal(savedSchedule.schedule_type, 'one_off');
      assert.equal(savedSchedule.recurrence_interval, null, 'recurrence_interval must be null for one_off schedules');
    });

    await st.test('5.9 Multi-row D1 atomicity preserves partial success across rows without exposing failed occurrences', async () => {
      const mockDb = createMockDb();
      // Fail only for Client B during batch execution
      mockDb.batch = async (statements) => {
        const isClientB = statements.some(s => {
          const sql = typeof s === 'string' ? s : s.sql;
          const args = typeof s === 'string' ? [] : (s.args || []);
          return args.some(a => String(a).includes('Client B'));
        });
        if (isClientB) {
          throw new Error('D1 simulated constraint failure on Client B');
        }
        for (const s of statements) await mockDb.execute(s);
        return [];
      };

      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Client A (Success)', phoneNumber: '9876543211' },
          { contactPerson: 'Client B (Fail)', phoneNumber: '9876543212' }
        ],
        sendWhatsApp: true,
        schedule: {
          scheduleType: 'one_off',
          scheduledFor: '2026-09-14T10:00',
          timezone: 'Asia/Kolkata'
        }
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.importedCount, 1, 'Client A should succeed');
      assert.equal(res.data.failedCount, 1, 'Client B should fail');

      // Client A has its full set of records
      assert.equal(mockDb.records.loan_cases.length, 1);
      assert.equal(mockDb.records.loan_cases[0].contact_person, 'Client A (Success)');
      assert.equal(mockDb.records.schedules.length, 1);
      assert.equal(mockDb.records.scheduled_occurrences.length, 1);

      // Client B left 0 partial records, so scheduler scanner can never see or claim it
      const clientBCase = mockDb.records.loan_cases.find(c => c.contact_person.includes('Client B'));
      assert.equal(clientBCase, undefined, 'Client B must have no case record');
      const clientBSched = mockDb.records.schedules.find(s => s.phone_number.includes('9876543212'));
      assert.equal(clientBSched, undefined, 'Client B must have no schedule');
      assert.equal(mockDb.records.scheduled_occurrences.length, 1, 'Scanner only sees 1 occurrence (Client A)');
    });

    await st.test('5.10 200-row bulk import chunks queue publication into batches of <= 100', async () => {
      const mockDb = createMockDb();
      const publishedBatches = [];
      const mockQueue = {
        sendBatch: async (messages) => {
          assert.ok(messages.length <= 100, `sendBatch received ${messages.length} messages, exceeding 100 cap`);
          publishedBatches.push(messages);
          return { success: true };
        }
      };
      const mockEnv = { DB: mockDb, SCHEDULE_QUEUE: mockQueue };
      const rawClients = Array.from({ length: 200 }, (_, i) => ({
        contactPerson: `Bulk Client ${i + 1}`,
        phoneNumber: `980000${String(i + 1).padStart(4, '0')}`
      }));

      const mockContext = {
        req: {
          json: async () => ({
            clients: rawClients,
            sendWhatsApp: true
          })
        },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.importedCount, 200);
      assert.equal(publishedBatches.length, 2, 'Exactly 2 queue batches must be published for 200 clients');
      assert.equal(publishedBatches[0].length, 100, 'Batch 1 must contain exactly 100 messages');
      assert.equal(publishedBatches[1].length, 100, 'Batch 2 must contain exactly 100 messages');

      // Verify all occurrences in D1 are atomically claimed before queue dispatch
      assert.equal(mockDb.records.scheduled_occurrences.length, 200);
      const allClaimed = mockDb.records.scheduled_occurrences.every(o => o.operational_status === 'claimed');
      assert.ok(allClaimed, 'All 200 occurrences must be atomically claimed in D1');
    });

    await st.test('5.11 Direct bulk queue publication claims occurrence first, preventing concurrent Cron scan race', async () => {
      const mockDb = createMockDb();
      const mockQueue = { sendBatch: async () => ({ success: true }) };
      const mockEnv = { DB: mockDb, SCHEDULE_QUEUE: mockQueue };
      const rawClients = [
        { contactPerson: 'Concurrent Test Client', phoneNumber: '9876543201' }
      ];

      const mockContext = {
        req: { json: async () => ({ clients: rawClients, sendWhatsApp: true }) },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      await handleBulkImportCases(mockContext);
      assert.equal(mockDb.records.scheduled_occurrences.length, 1);
      assert.equal(mockDb.records.scheduled_occurrences[0].operational_status, 'claimed');

      // Scanner immediately runs concurrently
      const scannerQueue = { send: async () => {} };
      const scanResult = await scanAndClaimDueOccurrences(mockDb, scannerQueue);
      assert.equal(scanResult.claimed, 0, 'Scanner must claim 0 occurrences because bulk import already holds claim lease');
    });

    await st.test('5.12 Partial queue publication failure keeps occurrences durable in D1 for Cron recovery', async () => {
      const mockDb = createMockDb();
      let batchCount = 0;
      const mockQueue = {
        sendBatch: async (messages) => {
          batchCount++;
          if (batchCount === 2) {
            throw new Error('Simulated Cloudflare Queue outage on batch 2');
          }
          return { success: true };
        }
      };
      const mockEnv = { DB: mockDb, SCHEDULE_QUEUE: mockQueue };
      const rawClients = Array.from({ length: 200 }, (_, i) => ({
        contactPerson: `Partial Client ${i + 1}`,
        phoneNumber: `981000${String(i + 1).padStart(4, '0')}`
      }));

      const mockContext = {
        req: { json: async () => ({ clients: rawClients, sendWhatsApp: true }) },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.importedCount, 200, 'Import succeeds without failing HTTP response');
      assert.equal(mockDb.records.scheduled_occurrences.length, 200, 'All 200 occurrences durably recorded');

      // Simulate lease expiration for the un-enqueued 100 occurrences (set claimed_at to 15 mins ago)
      for (let i = 100; i < 200; i++) {
        mockDb.records.scheduled_occurrences[i].claimed_at = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      }

      // Cron scanner wakes up and claims the expired un-enqueued occurrences
      const enqueuedRecovery = [];
      const recoveryQueue = { send: async (msg) => enqueuedRecovery.push(msg) };
      const scanResult = await scanAndClaimDueOccurrences(mockDb, recoveryQueue, 100);
      assert.equal(scanResult.claimed, 100, 'Cron scanner must reclaim exactly the 100 orphaned occurrences');
      assert.equal(enqueuedRecovery.length, 100, 'All 100 reclaimed occurrences dispatched to queue');
    });

    await st.test('5.13 SENDING ambiguity protection: active in-flight vs orphaned interrupted', async () => {
      const mockDb = createMockDb();
      const mockEnv = { ENVIRONMENT: 'development' };
      const user = { id: 'usr_test_1', username: 'Test Agent' };

      // Case 1: Concurrent active in-flight send (age < 600s)
      mockDb.records.whatsapp_messages.push({
        id: 'msg_active',
        user_id: user.id,
        idempotency_key: 'idemp_usr_test_1_occ_active',
        status: 'SENDING',
        provider_message_id: null,
        created_at: new Date().toISOString(),
        age_seconds: 5
      });

      const activeRes = await executeWhatsAppMessagingPipeline(
        mockDb, user, '9876543201', 'welcome_template', 'Active Client',
        'tok_1', mockEnv, 'occ_active'
      );
      assert.equal(activeRes.success, false);
      assert.equal(activeRes.inFlight, true, 'Active in-flight must be flagged as inFlight');
      assert.equal(activeRes.ambiguous, false, 'Active in-flight must not be marked ambiguous');

      // Consumer handling of active in-flight: yields without setting occurrence to unknown
      mockDb.records.scheduled_occurrences.push({
        id: 'active',
        schedule_id: 'sch_active',
        occurrence_key: 'key_active',
        scheduled_for_utc: new Date().toISOString(),
        operational_status: 'claimed',
        attempts: 1
      });
      mockDb.records.schedules.push({
        id: 'sch_active',
        user_id: user.id,
        phone_number: '9876543201',
        template_name: 'welcome_template',
        status: 'active',
        schedule_type: 'one_off'
      });

      const consumerRes = await processScheduledOccurrence('active', mockEnv, mockDb);
      assert.equal(consumerRes.handled, true);
      assert.equal(consumerRes.status, 'in_flight_duplicate');
      const activeOcc = mockDb.records.scheduled_occurrences.find(o => o.id === 'active');
      assert.equal(activeOcc.operational_status, 'claimed', 'Occurrence must NOT be overwritten to unknown during active lease');

      // Case 2: Orphaned SENDING older than lease (age >= 600s)
      mockDb.records.whatsapp_messages.push({
        id: 'msg_orphaned',
        user_id: user.id,
        idempotency_key: 'idemp_usr_test_1_occ_orphaned',
        status: 'SENDING',
        provider_message_id: null,
        created_at: new Date(Date.now() - 700 * 1000).toISOString(),
        age_seconds: 700
      });

      const orphanedRes = await executeWhatsAppMessagingPipeline(
        mockDb, user, '9876543202', 'welcome_template', 'Orphaned Client',
        'tok_2', mockEnv, 'occ_orphaned'
      );
      assert.equal(orphanedRes.success, false);
      assert.equal(orphanedRes.ambiguous, true, 'Orphaned execution must be flagged ambiguous');
      assert.equal(orphanedRes.inFlight, false);

      // Verify whatsapp_messages was updated to UNKNOWN
      const orphanedMsg = mockDb.records.whatsapp_messages.find(m => m.id === 'msg_orphaned');
      assert.equal(orphanedMsg.status, 'UNKNOWN');
    });

    await st.test('5.14 Provider ID reconciliation: SENDING with provider_message_id reconciles as sent without calling Meta', async () => {
      const mockDb = createMockDb();
      const mockEnv = { ENVIRONMENT: 'development' };
      const user = { id: 'usr_test_1', username: 'Test Agent' };

      mockDb.records.whatsapp_messages.push({
        id: 'msg_reconciled',
        user_id: user.id,
        idempotency_key: 'idemp_usr_test_1_occ_reconciled',
        status: 'SENDING',
        provider_message_id: 'wamid.HBgM_RECONCILED_TEST',
        created_at: new Date().toISOString(),
        age_seconds: 10
      });

      const res = await executeWhatsAppMessagingPipeline(
        mockDb, user, '9876543203', 'welcome_template', 'Reconciled Client',
        'tok_3', mockEnv, 'occ_reconciled'
      );
      assert.equal(res.success, true);
      assert.equal(res.idempotent, true);
      assert.equal(res.providerMsgId, 'wamid.HBgM_RECONCILED_TEST');
    });

    await st.test('5.15 Terminal state guards: queue delivery arriving after occurrence terminal immediately acks without Meta call', async () => {
      const mockDb = createMockDb();
      const mockEnv = { ENVIRONMENT: 'development' };
      const user = { id: 'usr_test_1', username: 'Test Agent' };

      const terminalStatuses = ['unknown', 'completed', 'skipped'];
      for (const tStatus of terminalStatuses) {
        const occId = `occ_term_${tStatus}`;
        const schId = `sch_term_${tStatus}`;
        mockDb.records.schedules.push({
          id: schId, user_id: user.id, phone_number: '9876543204', template_name: 'test_tpl', status: 'active', schedule_type: 'one_off'
        });
        mockDb.records.scheduled_occurrences.push({
          id: occId, schedule_id: schId, occurrence_key: `key_${tStatus}`, scheduled_for_utc: new Date().toISOString(), operational_status: tStatus
        });

        const res = await processScheduledOccurrence(occId, mockEnv, mockDb);
        assert.equal(res.handled, true);
        assert.equal(res.status, tStatus);
        assert.equal(res.alreadyDone, true);
      }

      // Cancelled schedule check
      const cancOccId = 'occ_canc';
      const cancSchId = 'sch_canc';
      mockDb.records.schedules.push({
        id: cancSchId, user_id: user.id, phone_number: '9876543205', template_name: 'test_tpl', status: 'cancelled', schedule_type: 'one_off'
      });
      mockDb.records.scheduled_occurrences.push({
        id: cancOccId, schedule_id: cancSchId, occurrence_key: 'key_canc', scheduled_for_utc: new Date().toISOString(), operational_status: 'pending'
      });
      const cancRes = await processScheduledOccurrence(cancOccId, mockEnv, mockDb);
      assert.equal(cancRes.handled, true);
      assert.equal(cancRes.status, 'skipped');
      assert.equal(cancRes.reason, 'cancelled');
    });

    await st.test('5.16 Tenant-scoped credit isolation: Tenant A (0 balance) skips while Tenant B (900 balance) delivers', async () => {
      const mockDb = createMockDb();
      const mockEnv = { ENVIRONMENT: 'development', MOCK_WHATSAPP: 'true', MOCK_WHATSAPP_STATUS: 'sent' };

      // Tenant A: 0 balance
      mockDb.records.users.push({ id: 'usr_tenant_a', username: 'Tenant A', credit_balance: 0 });
      mockDb.records.schedules.push({
        id: 'sch_tenant_a', user_id: 'usr_tenant_a', phone_number: '9876543206', template_name: 'test_tpl', status: 'active', schedule_type: 'one_off'
      });
      mockDb.records.scheduled_occurrences.push({
        id: 'occ_tenant_a', schedule_id: 'sch_tenant_a', occurrence_key: 'key_tenant_a', scheduled_for_utc: new Date().toISOString(), operational_status: 'claimed'
      });

      // Tenant B: 900 balance
      mockDb.records.users.push({ id: 'usr_tenant_b', username: 'Tenant B', credit_balance: 900 });
      mockDb.records.schedules.push({
        id: 'sch_tenant_b', user_id: 'usr_tenant_b', phone_number: '9876543207', template_name: 'test_tpl', status: 'active', schedule_type: 'one_off'
      });
      mockDb.records.scheduled_occurrences.push({
        id: 'occ_tenant_b', schedule_id: 'sch_tenant_b', occurrence_key: 'key_tenant_b', scheduled_for_utc: new Date().toISOString(), operational_status: 'claimed'
      });

      // Process Tenant A
      const resA = await processScheduledOccurrence('occ_tenant_a', mockEnv, mockDb);
      assert.equal(resA.handled, true);
      assert.equal(resA.status, 'skipped');
      assert.equal(resA.reason, 'insufficient_credits');

      const occA = mockDb.records.scheduled_occurrences.find(o => o.id === 'occ_tenant_a');
      assert.equal(occA.operational_status, 'skipped');

      // Process Tenant B - should succeed and deduct
      const resB = await processScheduledOccurrence('occ_tenant_b', mockEnv, mockDb);
      assert.equal(resB.handled, true);
      assert.equal(resB.status, 'completed');

      const userB = mockDb.records.users.find(u => u.id === 'usr_tenant_b');
      assert.equal(userB.credit_balance, 810, 'Tenant B balance must be deducted by 90 paise');
    });

    await st.test('5.17 Concurrency race test: Consumer A and Consumer B racing simultaneously on same occurrence - exactly 1 Meta send', async () => {
      const mockDb = createMockDb();
      const mockEnv = {
        ENVIRONMENT: 'development',
        MOCK_WHATSAPP: 'true',
        MOCK_WHATSAPP_STATUS: 'sent'
      };

      // Set up occurrence and schedule
      mockDb.records.users.push({ id: 'usr_race_test', username: 'Race Agent', credit_balance: 900 });
      mockDb.records.schedules.push({
        id: 'sch_race_test',
        user_id: 'usr_race_test',
        phone_number: '9876543299',
        template_name: 'test_tpl',
        status: 'active',
        schedule_type: 'one_off'
      });
      mockDb.records.scheduled_occurrences.push({
        id: 'occ_race_test',
        schedule_id: 'sch_race_test',
        occurrence_key: 'key_race_test',
        scheduled_for_utc: new Date().toISOString(),
        operational_status: 'claimed'
      });

      // Both consumers execute simultaneously: Promise.all([Consumer A, Consumer B])
      const [resA, resB] = await Promise.all([
        processScheduledOccurrence('occ_race_test', mockEnv, mockDb),
        processScheduledOccurrence('occ_race_test', mockEnv, mockDb)
      ]);

      // Assertions:
      // One consumer must succeed and complete
      // The other consumer must detect inFlight and yield as duplicate
      const statuses = [resA.status, resB.status];
      assert.ok(statuses.includes('completed'), 'One consumer must complete successfully');
      assert.ok(statuses.includes('in_flight_duplicate'), 'The concurrent duplicate consumer must recognize in-flight dispatch and yield');

      // Crucial: Exactly 1 row in whatsapp_messages, status SENT
      assert.equal(mockDb.records.whatsapp_messages.length, 1, 'Exactly one whatsapp_messages record must exist');
      assert.equal(mockDb.records.whatsapp_messages[0].status, 'SENT');

      // Crucial: Credit deducted exactly once (900 - 90 = 810)
      const raceUser = mockDb.records.users.find(u => u.id === 'usr_race_test');
      assert.equal(raceUser.credit_balance, 810, 'Credits must be deducted exactly once despite concurrent consumers');

      // Crucial: Occurrence in D1 is completed
      const finalOcc = mockDb.records.scheduled_occurrences.find(o => o.id === 'occ_race_test');
      assert.equal(finalOcc.operational_status, 'completed');
    });
  });
});
