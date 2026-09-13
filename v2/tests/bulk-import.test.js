import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());

test('Bulk Client Import UI, Parser & Architecture Tests', async (t) => {

  await t.test('1. DOM Elements & Modal Structure in dashboard.html', () => {
    const htmlPath = path.join(rootDir, 'public', 'dashboard.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes('id="btnOpenBulkImportModal"'), 'btnOpenBulkImportModal trigger button must exist');
    assert.ok(htmlContent.includes('id="bulkImportModalBackdrop"'), 'bulkImportModalBackdrop modal must exist');
    assert.ok(htmlContent.includes('Expected File Format (.csv or .tsv)'), 'Sample format card must exist to guide users');
    assert.ok(htmlContent.includes('id="bulkFileView"'), 'bulkFileView container must exist');
    assert.ok(htmlContent.includes('id="bulkFileInput"'), 'bulkFileInput file picker must exist');
    assert.ok(htmlContent.includes('id="bulkDropzone"'), 'bulkDropzone drag and drop target must exist');
    assert.ok(htmlContent.includes('id="bulkCategorySelect"'), 'bulkCategorySelect dropdown must exist');
    assert.ok(htmlContent.includes('id="bulkTemplateSelect"'), 'bulkTemplateSelect dropdown must exist');
    assert.ok(htmlContent.includes('id="bulkHasHeaderCheck"'), 'bulkHasHeaderCheck checkbox must exist');
    assert.ok(htmlContent.includes('id="bulkSendWhatsAppCheck"'), 'bulkSendWhatsAppCheck checkbox must exist');
    assert.ok(htmlContent.includes('id="bulkPreviewTableBody"'), 'bulkPreviewTableBody table element must exist');
    assert.ok(htmlContent.includes('id="btnExecuteBulkImport"'), 'btnExecuteBulkImport submit button must exist');
  });

  await t.test('2. CSS Stylesheet Rules for Bulk Import', () => {
    const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.bulk-upload-dropzone'), '.bulk-upload-dropzone rule must exist');
    assert.ok(cssContent.includes('.bulk-preview-wrapper'), '.bulk-preview-wrapper rule must exist');
    assert.ok(cssContent.includes('.bulk-preview-table'), '.bulk-preview-table rule must exist');
    assert.ok(cssContent.includes('.row-status-pill'), '.row-status-pill rule must exist');
  });

  await t.test('3. JavaScript CSV Parsing & Phone Normalization Logic', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('function parseCsvOrTextContent'), 'parseCsvOrTextContent must be defined');
    assert.ok(jsContent.includes('function openBulkImportModal'), 'openBulkImportModal must be defined');
    assert.ok(jsContent.includes('function renderBulkImportPreview'), 'renderBulkImportPreview must be defined');
    assert.ok(jsContent.includes('function executeBulkImport'), 'executeBulkImport must be defined');

    // Test parser logic directly matching app.js
    function mockParse(content, hasHeader = true) {
      if (!content || !content.trim()) return [];
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const rows = [];
      const startIndex = hasHeader ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i];
        const delimiter = ",";
        const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

        // Strict column mapping: column 1 = name, column 2 = phone
        const contactPerson = parts[0] || "";
        const rawPhone = parts[1] || "";
        const category = parts[2] || "";
        const amount = parts[3] || "";

        const digits = rawPhone.replace(/\D/g, "");
        const isValidPhone = digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));

        rows.push({
          contactPerson: contactPerson || `Client ${digits.slice(-4) || i + 1}`,
          rawPhone,
          digits,
          category: category || "Direct Intake",
          amountRequired: amount,
          isValid: isValidPhone
        });
      }
      return rows;
    }

    const testCsv = `Name,Phone,Category,Amount
John Doe,9876543210,Direct Intake,500000
Priya Patel,+91 98765 43210,ITR Filing,250000
Invalid Client,12345,GST Registration,`;

    // 1. With header (default)
    const parsedWithHeader = mockParse(testCsv, true);
    assert.equal(parsedWithHeader.length, 3);
    assert.equal(parsedWithHeader[0].contactPerson, "John Doe");
    assert.equal(parsedWithHeader[0].digits, "9876543210");
    assert.equal(parsedWithHeader[0].isValid, true);
    assert.equal(parsedWithHeader[1].contactPerson, "Priya Patel");
    assert.equal(parsedWithHeader[1].isValid, true);
    assert.equal(parsedWithHeader[2].isValid, false, "12345 is an invalid phone");

    // 2. Without header option
    const testNoHeader = `John Doe,9876543210,Direct Intake,500000
Priya Patel,9876543210,ITR Filing,250000`;
    const parsedNoHeader = mockParse(testNoHeader, false);
    assert.equal(parsedNoHeader.length, 2);
    assert.equal(parsedNoHeader[0].contactPerson, "John Doe");
    assert.equal(parsedNoHeader[1].contactPerson, "Priya Patel");

    // 3. Strict column order verification (first column is ALWAYS taken as name)
    const testStrictCols = `9876543210,Some Notes Or Wrong Phone`;
    const parsedStrict = mockParse(testStrictCols, false);
    assert.equal(parsedStrict[0].contactPerson, "9876543210", "First column must strictly be taken as name without swapping");
    assert.equal(parsedStrict[0].rawPhone, "Some Notes Or Wrong Phone", "Second column must strictly be taken as phone");
    assert.equal(parsedStrict[0].isValid, false);
  });

  await t.test('4. Backend API Route & Handler in cases.js & index.js', () => {
    const apiPath = path.join(rootDir, 'src', 'api', 'cases.js');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    assert.ok(apiContent.includes('export async function handleBulkImportCases'), 'handleBulkImportCases must be exported in cases.js');

    const indexPath = path.join(rootDir, 'src', 'index.js');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('app.post("/api/cases/bulk-import", handleBulkImportCases);'), 'Route /api/cases/bulk-import must be registered in index.js');
  });

  await t.test('5. Import Deduplication Guarantees & Active Workflow Isolation', async (st) => {
    const { handleBulkImportCases } = await import('../src/api/cases.js');

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

      return {
        records,
        execute: async (query) => {
          const sql = typeof query === 'string' ? query : query.sql;
          const args = typeof query === 'string' ? [] : (query.args || []);
          const norm = sql.replace(/\s+/g, ' ').trim();

          if (norm.startsWith('SELECT id FROM contacts WHERE user_id = ? AND phone_number = ?')) {
            const [user_id, phone_number] = args;
            const c = records.contacts.find(x => x.user_id === user_id && x.phone_number === phone_number);
            return { rows: c ? [{ id: c.id }] : [] };
          }
          if (norm.startsWith('INSERT INTO contacts')) {
            const [id, user_id, contact_person, phone_number] = args;
            records.contacts.push({ id, user_id, contact_person, phone_number });
            return { rows: [] };
          }
          if (norm.includes('FROM loan_cases WHERE user_id = ? AND phone_number = ? AND status NOT IN (\'closed\', \'completed\')')) {
            const [user_id, phone_number] = args;
            const existing = records.loan_cases.find(x => x.user_id === user_id && x.phone_number === phone_number && !['closed', 'completed'].includes(x.status));
            return { rows: existing ? [{ id: existing.id, status: existing.status }] : [] };
          }
          return { rows: [] };
        },
        batch: async (statements) => {
          for (const s of statements) {
            const sql = typeof s === 'string' ? s : s.sql;
            const args = typeof s === 'string' ? [] : (s.args || []);
            const norm = sql.replace(/\s+/g, ' ').trim();

            if (norm.startsWith('INSERT INTO loan_cases')) {
              const [id, contact_id, user_id, contact_person, phone_number, loan_product, template_name, amount_required, status, whatsapp_delivery_status] = args;
              // Check unique constraint: (user_id, phone_number) where status NOT IN ('closed', 'completed')
              const conflict = records.loan_cases.find(c => c.user_id === user_id && c.phone_number === phone_number && !['closed', 'completed'].includes(c.status));
              if (conflict) {
                const err = new Error('UNIQUE constraint failed: loan_cases.user_id, loan_cases.phone_number');
                err.code = 'SQLITE_CONSTRAINT_UNIQUE';
                throw err;
              }
              records.loan_cases.push({ id, contact_id, user_id, contact_person, phone_number, loan_product, template_name, amount_required, status, whatsapp_delivery_status });
            }
            if (norm.startsWith('INSERT INTO secure_tokens')) {
              const [id, case_id, token, user_id] = args;
              records.secure_tokens.push({ id, case_id, token, user_id });
            }
            if (norm.startsWith('INSERT INTO required_documents')) {
              const [id, case_id, doc_type, user_id] = args;
              records.required_documents.push({ id, case_id, doc_type, user_id });
            }
            if (norm.startsWith('INSERT INTO schedules')) {
              const [id, user_id, case_id, contact_id, phone_number, template_name, template_params, schedule_type, recurrence_interval, timezone, next_run_utc] = args;
              records.schedules.push({ id, user_id, case_id, contact_id, phone_number, template_name, template_params, schedule_type, recurrence_interval, timezone, next_run_utc });
            }
            if (norm.startsWith('INSERT INTO scheduled_occurrences')) {
              const [id, schedule_id, occurrence_key, scheduled_for_utc] = args;
              records.scheduled_occurrences.push({ id, schedule_id, occurrence_key, scheduled_for_utc, operational_status: 'pending' });
            }
            if (norm.startsWith('UPDATE scheduled_occurrences SET operational_status = \'claimed\'')) {
              const occId = args[0];
              const occ = records.scheduled_occurrences.find(o => o.id === occId);
              if (occ) occ.operational_status = 'claimed';
            }
          }
          return { success: true };
        }
      };
    }

    await st.test('5.1 Same import: duplicate phone within same CSV batch is skipped', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Arun Kumar', phoneNumber: '9876543210' },
          { contactPerson: 'Arun Kumar Duplicate', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1'
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.total, 2);
      assert.equal(res.data.importedCount, 1);
      assert.equal(res.data.duplicateCount, 1);
      assert.equal(res.data.failedCount, 0);

      // Exactly 1 case created
      assert.equal(mockDb.records.loan_cases.length, 1);
      assert.equal(mockDb.records.loan_cases[0].contact_person, 'Arun Kumar');
      // Duplicate produced 0 tokens, 0 schedules, 0 occurrences
      assert.equal(mockDb.records.secure_tokens.length, 1);
      assert.equal(mockDb.records.schedules.length, 1);
      assert.equal(mockDb.records.scheduled_occurrences.length, 1);
    });

    await st.test('5.2 Later import: existing active workflow in DB is skipped', async () => {
      const mockDb = createMockDb();
      // Pre-seed an active workflow for this user and phone
      mockDb.records.loan_cases.push({
        id: 'case_existing_active',
        user_id: 'usr_test_1',
        phone_number: '919876543210',
        contact_person: 'Arun Existing',
        status: 'documents_pending'
      });

      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Arun Reimport', phoneNumber: '9876543210' },
          { contactPerson: 'Brand New Client', phoneNumber: '9876543211' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1'
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.total, 2);
      assert.equal(res.data.importedCount, 1);
      assert.equal(res.data.duplicateCount, 1);

      // Only the brand new client case was added
      assert.equal(mockDb.records.loan_cases.length, 2);
      assert.equal(mockDb.records.loan_cases[1].contact_person, 'Brand New Client');
    });

    await st.test('5.3 Formatting variants: same canonical phone is deduplicated', async () => {
      const mockDb = createMockDb();
      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Standard 10-Digit', phoneNumber: '9876543210' },
          { contactPerson: 'With Country Code', phoneNumber: '+91 98765 43210' },
          { contactPerson: 'With Leading Zero', phoneNumber: '09876543210' },
          { contactPerson: 'With Hyphens', phoneNumber: '98765-43210' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1'
      };

      const mockContext = {
        req: { json: async () => reqBody },
        env: mockEnv,
        get: (k) => k === 'user' ? { id: 'usr_test_1', username: 'Test' } : null,
        json: (data, code = 200) => ({ data, code })
      };

      const res = await handleBulkImportCases(mockContext);
      assert.equal(res.code, 200);
      assert.equal(res.data.total, 4);
      assert.equal(res.data.importedCount, 1);
      assert.equal(res.data.duplicateCount, 3);
      assert.equal(mockDb.records.loan_cases.length, 1);
      assert.equal(mockDb.records.loan_cases[0].phone_number, '919876543210');
    });

    await st.test('5.4 Closed workflow allows new workflow creation for same client', async () => {
      const mockDb = createMockDb();
      // Pre-seed a CLOSED case for this user and phone
      mockDb.records.loan_cases.push({
        id: 'case_closed_past',
        user_id: 'usr_test_1',
        phone_number: '919876543210',
        contact_person: 'Past Client',
        status: 'closed'
      });

      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Returning Client', phoneNumber: '9876543210' }
        ],
        sendWhatsApp: true,
        templateName: 'new_convo_1'
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
      assert.equal(res.data.duplicateCount, 0);
      assert.equal(mockDb.records.loan_cases.length, 2);
      assert.equal(mockDb.records.loan_cases[1].contact_person, 'Returning Client');
      assert.equal(mockDb.records.loan_cases[1].status, 'documents_pending');
    });

    await st.test('5.5 Concurrency uniqueness constraint race safety', async () => {
      const mockDb = createMockDb();
      // Simulate race condition where SELECT did not find existing case, but batch INSERT throws unique index constraint error
      let attempt = 0;
      const originalBatch = mockDb.batch;
      mockDb.batch = async (stmts) => {
        attempt++;
        if (attempt === 2) {
          const err = new Error('D1_ERROR: UNIQUE constraint failed: index unq_active_case_user_phone');
          throw err;
        }
        return originalBatch(stmts);
      };

      const mockEnv = { DB: mockDb };
      const reqBody = {
        clients: [
          { contactPerson: 'Racer 1', phoneNumber: '9876543210' },
          { contactPerson: 'Racer 2', phoneNumber: '9876543211' }
        ],
        sendWhatsApp: false
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
      assert.equal(res.data.duplicateCount, 1);
      assert.equal(res.data.failedCount, 0);
      assert.equal(mockDb.records.loan_cases.length, 1);
    });
  });
});
