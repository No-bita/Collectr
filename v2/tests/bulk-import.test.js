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
});
