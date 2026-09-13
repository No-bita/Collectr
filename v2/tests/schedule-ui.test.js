import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleBulkImportCases } from '../src/api/cases.js';
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
    assert.ok(html.includes('id="scheduleRecurrence"'), 'scheduleRecurrence select dropdown must exist');
    assert.ok(html.includes('id="btnCancelWizardSchedule"'), 'btnCancelWizardSchedule must exist');
    assert.ok(html.includes('id="btnSetWizardSchedule"'), 'btnSetWizardSchedule must exist');

    // Recurrence options
    assert.ok(html.includes('value="one_off"'), 'one_off recurrence option must exist');
    assert.ok(html.includes('value="daily"'), 'daily recurrence option must exist');
    assert.ok(html.includes('value="weekly"'), 'weekly recurrence option must exist');
    assert.ok(html.includes('value="monthly"'), 'monthly recurrence option must exist');

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
    assert.ok(html.includes('id="bulkScheduleRecurrence"'), 'bulkScheduleRecurrence select must exist');
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
        contacts: [],
        loan_cases: [],
        secure_tokens: [],
        required_documents: [],
        schedules: [],
        scheduled_occurrences: [],
        case_timeline: []
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
          if (item) item.whatsapp_delivery_status = 'scheduled';
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
            id, schedule_id, occurrence_key, scheduled_for_utc, operational_status: 'pending'
          });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO case_timeline')) {
          records.case_timeline.push({ sql, args });
          return { rows: [] };
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

    await st.test('5.3 Recurring bulk scheduling creates ONLY the first occurrence (does not generate future ones)', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const futureDate = new Date(Date.now() + 24 * 3600 * 1000);
      const reqBody = {
        clients: [
          { contactPerson: 'Recurring Client', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1',
        schedule: {
          scheduledFor: futureDate.toISOString(),
          scheduleType: 'recurring',
          recurrenceInterval: 'weekly',
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
      assert.equal(mockDb.records.schedules[0].schedule_type, 'recurring');
      assert.equal(mockDb.records.schedules[0].recurrence_interval, 'weekly');
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
  });
});
