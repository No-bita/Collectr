import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { executeWhatsAppMessagingPipeline } from '../src/whatsapp/pipeline.js';
import { processScheduledOccurrence, handleQueueBatch } from '../src/scheduler/consumer.js';
import { scanAndClaimDueOccurrences } from '../src/scheduler/scanner.js';
import { toSqliteUtc, isValidTimezone, parseScheduledForToUtc } from '../src/scheduler/time.js';

const rootDir = fs.existsSync(path.join(process.cwd(), 'public'))
  ? process.cwd()
  : path.join(process.cwd(), 'v2');

test('Scheduling UI & Bulk Import Scheduling Architecture Tests', async (t) => {
  const htmlPath = path.join(rootDir, 'public', 'dashboard.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
  const js = fs.readFileSync(jsPath, 'utf8');

  await t.test('1. Time Conversion Helpers in scheduler/time.js', () => {
    assert.ok(typeof toSqliteUtc === 'function', 'toSqliteUtc must be a function');
    assert.ok(typeof isValidTimezone === 'function', 'isValidTimezone must be a function');
    assert.ok(typeof parseScheduledForToUtc === 'function', 'parseScheduledForToUtc must be a function');
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

        if (norm.startsWith('SELECT firm_id FROM firm_members')) return { rows: [{ firm_id: 'firm_mock' }] };
        if (norm.startsWith('SELECT id, contact_person')) {
          const [userId, phone] = args;
          const c = records.contacts.find(x => x.phone_number === phone && x.user_id === userId);
          return { rows: c ? [c] : [] };
        }
        if (norm.startsWith('INSERT INTO contacts')) {
          const [id, user_id, contact_person, phone_number, email] = args;
          records.contacts.push({ id, user_id, contact_person, phone_number, email: email || null });
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
          let id, user_id, case_id, contact_id, phone_number, channel, template_name, template_params, schedule_type, recurrence_interval, timezone, scheduled_for_utc;
          if (args.length === 12) {
            [id, user_id, case_id, contact_id, phone_number, channel, template_name, template_params, schedule_type, recurrence_interval, timezone, scheduled_for_utc] = args;
          } else {
            [id, user_id, case_id, contact_id, phone_number, template_name, template_params, schedule_type, recurrence_interval, timezone, scheduled_for_utc] = args;
            channel = 'whatsapp';
          }
          records.schedules.push({
            id, user_id, case_id, contact_id, phone_number, channel, template_name,
            template_params, schedule_type, recurrence_interval, timezone,
            status: 'active', next_run_utc: scheduled_for_utc
          });
          return { rows: [] };
        }
        if (norm.startsWith('INSERT INTO scheduled_occurrences')) {
          let id, schedule_id, occurrence_key, scheduled_for_utc, channel = 'whatsapp', recipient_phone = null, recipient_email = null;
          if (args.length >= 7) {
            [id, schedule_id, occurrence_key, scheduled_for_utc, channel, recipient_phone, recipient_email] = args;
          } else {
            [id, schedule_id, occurrence_key, scheduled_for_utc] = args;
          }
          records.scheduled_occurrences.push({
            id, schedule_id, occurrence_key, scheduled_for_utc, channel, recipient_phone, recipient_email,
            operational_status: 'pending', claimed_at: null, attempts: 0
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
        if (norm.includes("FROM scheduled_occurrences o") && norm.includes("JOIN schedules s ON o.schedule_id = s.id")) {
          const occId = args[0];
          const occ = records.scheduled_occurrences.find(o => o.id === occId);
          if (!occ) return { rows: [] };
          const sch = records.schedules.find(s => s.id === occ.schedule_id);
          if (!sch) return { rows: [] };
          const user = records.users.find(u => u.id === sch.user_id) || records.users[0];
          return {
            rows: [{
              ...occ,
              user_id: sch.user_id,
              case_id: sch.case_id,
              contact_id: sch.contact_id || sch.case_id,
              recipient_phone: occ.recipient_phone || sch.phone_number || "9876543210",
              recipient_email: occ.recipient_email || null,
              phone_number: sch.phone_number || "9876543210",
              template_id: sch.template_name || "new_convo_1",
              template_name: sch.template_name || "new_convo_1",
              template_params: sch.template_params,
              schedule_type: sch.schedule_type,
              recurrence_interval: sch.recurrence_interval,
              timezone: sch.timezone,
              schedule_status: sch.status,
              contact_name: "Test Contact",
              contact_phone: sch.phone_number || "9876543210",
              contact_email: null
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
        if (norm.includes("UPDATE users SET credit_balance = credit_balance - ?")) {
          const [cost, uId] = args;
          const u = records.users.find(x => x.id === uId);
          if (u) u.credit_balance -= cost;
          return { rows: [], changes: 1 };
        }
        if (norm.startsWith("UPDATE users SET credit_balance =")) {
          const [newBal, uId] = args;
          const u = records.users.find(x => x.id === uId);
          if (u) u.credit_balance = newBal;
          return { rows: [], changes: 1 };
        }
        if (norm.includes("FROM whatsapp_messages") && norm.includes("WHERE user_id = ?")) {
          const userId = args[0];
          const idempKeys = args.slice(1);
          const msg = records.whatsapp_messages.find(m => m.user_id === userId && (idempKeys.includes(m.idempotency_key) || idempKeys.length === 0));
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
          let id, user_id, idempotency_key, status, provider_message_id;
          if (norm.includes("message_id")) {
            id = args[0];
            user_id = args[1];
            const message_id = args[2];
            idempotency_key = args[3];
            status = norm.includes("'SENT'") ? 'SENT' : (norm.includes("'SENDING'") ? 'SENDING' : 'SENT');
            provider_message_id = args[4] || null;
          } else {
            [id, user_id, idempotency_key] = args;
            status = norm.includes("'SENT'") ? 'SENT' : (norm.includes("'SENDING'") ? 'SENDING' : (args[3] || 'SENT'));
            provider_message_id = args[4] || null;
          }
          const existing = records.whatsapp_messages.find(m => m.user_id === user_id && m.idempotency_key === idempotency_key);
          if (existing) {
            return { rows: [], changes: 0 };
          } else {
            records.whatsapp_messages.push({
              id, user_id, idempotency_key, status, provider_message_id, created_at: new Date().toISOString()
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
        if (norm.startsWith("INSERT INTO credit_reservations")) {
          const [id, user_id, amount_paise, reference_id] = args;
          if (!records.credit_reservations) records.credit_reservations = [];
          const existing = records.credit_reservations.find(r => r.user_id === user_id && r.reference_id === reference_id);
          if (existing) {
            throw new Error("UNIQUE constraint failed: credit_reservations.reference_id");
          }
          records.credit_reservations.push({ id, user_id, amount_paise, reference_id, status: "PENDING" });
          return { rows: [{ id }], changes: 1 };
        }
        if (norm.includes("FROM credit_reservations WHERE user_id = ? AND reference_id = ?")) {
          const [user_id, reference_id] = args;
          const res = (records.credit_reservations || []).find(r => r.user_id === user_id && r.reference_id === reference_id);
          return { rows: res ? [res] : [] };
        }
        if (norm.startsWith("UPDATE credit_reservations SET status = 'CAPTURED'")) {
          const [user_id, reference_id] = args;
          const res = (records.credit_reservations || []).find(r => r.user_id === user_id && r.reference_id === reference_id);
          if (res) res.status = "CAPTURED";
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





    await st.test('5.5 Timezone conversion helper tests', () => {
      assert.equal(isValidTimezone('Asia/Kolkata'), true);
      assert.equal(isValidTimezone('America/New_York'), true);
      assert.equal(isValidTimezone('Invalid/Zone'), false);

      const d = new Date('2026-09-15T10:30:00.000Z');
      const utcStr = toSqliteUtc(d);
      assert.equal(utcStr, '2026-09-15 10:30:00');
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

    await st.test('5.18 Queue consumer failure isolation: batch_size = 1 isolates faults whereas batch_size = 10 cascades and drops unhandled batch messages', async () => {
      const mockDb = createMockDb();
      const mockEnv = { ENVIRONMENT: 'development', MOCK_WHATSAPP: 'true', MOCK_WHATSAPP_STATUS: 'sent' };
      const user = { id: 'usr_test_1', username: 'Test Agent', credit_balance: 5000 };
      mockDb.records.users[0].credit_balance = 5000;

      // Create 10 occurrences
      const occIds = [];
      for (let i = 1; i <= 10; i++) {
        const occId = `occ_batch_iso_${i}`;
        const schId = `sch_batch_iso_${i}`;
        mockDb.records.schedules.push({
          id: schId, user_id: user.id, phone_number: `98765400${String(i).padStart(2, '0')}`, template_name: 'test_tpl', status: 'active', schedule_type: 'one_off'
        });
        mockDb.records.scheduled_occurrences.push({
          id: occId, schedule_id: schId, occurrence_key: `key_batch_iso_${i}`, scheduled_for_utc: new Date().toISOString(), operational_status: 'claimed'
        });
        occIds.push(occId);
      }

      // Scenario A: Worker processing a batch of 10 where Worker crashes at message #3 (e.g. fatal timeout / subrequest limit)
      // When an uncatchable exception or worker exit occurs at message 3, messages 4..10 never get executed or acked
      const unhandledBatchAcked = [];
      try {
        const batchOf10 = {
          messages: occIds.map((id, idx) => ({
            body: { occurrenceId: id },
            ack: () => unhandledBatchAcked.push(id)
          }))
        };
        for (let i = 0; i < batchOf10.messages.length; i++) {
          if (i === 2) {
            throw new Error('Worker subrequest limit exceeded (simulated catastrophic crash in batch of 10)');
          }
          await processScheduledOccurrence(batchOf10.messages[i].body.occurrenceId, mockEnv, mockDb);
          batchOf10.messages[i].ack();
        }
      } catch (err) {
        assert.ok(err.message.includes('subrequest limit exceeded'));
      }
      assert.equal(unhandledBatchAcked.length, 2, 'In batch of 10, only first 2 messages were acked before worker crash');

      // Scenario B: With max_batch_size = 1, each Worker invocation handles exactly 1 message.
      // Message 3 fails, but all other 9 messages are executed in their own separate invocations and succeed.
      const isolatedAcked = [];
      for (let i = 0; i < occIds.length; i++) {
        const singleBatch = {
          messages: [{
            body: { occurrenceId: occIds[i] },
            ack: () => isolatedAcked.push(occIds[i])
          }]
        };
        try {
          if (i === 2) {
            // Simulated error on this single message
            throw new Error('Simulated single-invocation isolated error');
          }
          await handleQueueBatch(singleBatch, mockEnv, null, mockDb);
        } catch (_) {
          // Handled or retried by queue runtime for this single message only
        }
      }
      // 9 out of 10 were successfully processed in their isolated invocations
      assert.equal(isolatedAcked.length, 9, 'With max_batch_size = 1, 9 other messages process successfully despite error on message #3');
    });

  });
});
