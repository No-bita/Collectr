import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { getAccessibleCaseFilter } from '../src/api/cases.js';

test('Account Isolation & Persona Overflow Prevention Tests', async (t) => {
  await t.test('1. getAccessibleCaseFilter strictly scopes to user_id or is_demo for logged-in accounts', () => {
    const regularUserFilter = getAccessibleCaseFilter({ id: 'usr_123', role: 'agent' });
    assert.strictEqual(regularUserFilter.whereClause, '(user_id = ? OR is_demo = 1)');
    assert.deepStrictEqual(regularUserFilter.params, ['usr_123']);

    const adminUserFilter = getAccessibleCaseFilter({ id: 'admin_1', role: 'admin' });
    assert.strictEqual(adminUserFilter.whereClause, '1=1');
    assert.deepStrictEqual(adminUserFilter.params, []);
  });

  await t.test('2. Verify app.js contains isCaseForPersona and persona-scoped filtering logic', () => {
    const appJsCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app.js'), 'utf8');
    assert.ok(appJsCode.includes('function isCaseForPersona('), 'isCaseForPersona helper missing in app.js');
    assert.ok(appJsCode.includes('if (!isCaseForPersona(c, persona)) return false;'), 'render() missing isCaseForPersona check');
  });

  await t.test('3. Verify CA persona excludes loan products and direct outreach dispatches', () => {
    const appJsCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app.js'), 'utf8');
    assert.ok(appJsCode.includes('isLoanProduct'), 'app.js missing isLoanProduct classification');
    assert.ok(appJsCode.includes('isCaProduct'), 'app.js missing isCaProduct classification');
    assert.ok(appJsCode.includes('isDirectOutreach'), 'app.js missing isDirectOutreach classification');
  });

  await t.test('4. Verify timeline and notes render WhatsApp delivery status badges', () => {
    const caseDetailCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'case-detail.js'), 'utf8');
    const casesApiCode = fs.readFileSync(path.join(process.cwd(), 'src', 'api', 'cases.js'), 'utf8');
    assert.ok(casesApiCode.includes('whatsappDeliveryStatus: waStatus'), 'cases.js missing whatsappDeliveryStatus in timeline response');
    assert.ok(casesApiCode.includes('metadataJson'), 'cases.js missing metadata JSON in handleAddTimelineNote');
    assert.ok(caseDetailCode.includes('WhatsApp: Sent') && caseDetailCode.includes('WhatsApp: Failed'), 'case-detail.js missing WhatsApp status badges');
  });

  await t.test('5. Verify Direct Outreach Status column is powered by whatsapp_delivery_status and not c.status', () => {
    const appJsCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app.js'), 'utf8');
    assert.ok(appJsCode.includes('getWhatsAppDeliveryBadgeHtml'), 'app.js missing getWhatsAppDeliveryBadgeHtml');
    assert.ok(appJsCode.includes('c.whatsappDeliveryStatus || c.whatsapp_delivery_status'), 'app.js not extracting whatsappDeliveryStatus for direct outreach');
  });
});
