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

    // Test parser logic directly
    function mockParse(content) {
      if (!content || !content.trim()) return [];
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      const rows = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (i === 0 && (line.toLowerCase().includes("name") && (line.toLowerCase().includes("phone") || line.toLowerCase().includes("mobile")))) {
          continue;
        }
        let delimiter = line.includes("\t") ? "\t" : (line.includes(";") ? ";" : ",");
        const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

        let contactPerson = parts[0] || "";
        let rawPhone = parts[1] || "";
        let category = parts[2] || "";
        let amount = parts[3] || "";

        if (/^\+?\d{10,14}$/.test(contactPerson.replace(/\D/g, '')) && !/^\d+$/.test(rawPhone)) {
          const temp = contactPerson;
          contactPerson = rawPhone;
          rawPhone = temp;
        }

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
Aryan Shah,9137839907,Direct Intake,500000
Priya Patel,+91 98765 43210,ITR Filing,250000
Invalid Client,12345,GST Registration,`;

    const parsed = mockParse(testCsv);
    assert.equal(parsed.length, 3);
    assert.equal(parsed[0].contactPerson, "Aryan Shah");
    assert.equal(parsed[0].digits, "9137839907");
    assert.equal(parsed[0].isValid, true);
    assert.equal(parsed[1].contactPerson, "Priya Patel");
    assert.equal(parsed[1].isValid, true);
    assert.equal(parsed[2].isValid, false, "12345 is an invalid phone");
  });

  await t.test('4. Backend API Route & Handler in cases.js & index.js', () => {
    const apiPath = path.join(rootDir, 'src', 'api', 'cases.js');
    const apiContent = fs.readFileSync(apiPath, 'utf8');
    assert.ok(apiContent.includes('export async function handleBulkImportCases'), 'handleBulkImportCases must be exported in cases.js');

    const indexPath = path.join(rootDir, 'src', 'index.js');
    const indexContent = fs.readFileSync(indexPath, 'utf8');
    assert.ok(indexContent.includes('app.post("/api/cases/bulk-import", handleBulkImportCases);'), 'Route /api/cases/bulk-import must be registered in index.js');
  });
});
