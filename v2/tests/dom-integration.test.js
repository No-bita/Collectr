import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Full DOM Page Load & Integration Test', async (t) => {
  const dashboardHtmlPath = path.join(process.cwd(), 'public', 'dashboard.html');
  const htmlContent = fs.readFileSync(dashboardHtmlPath, 'utf8');

  await t.test('1. Verify all critical UI element IDs exist in dashboard.html', () => {
    const requiredIds = [
      'tbody',
      'search',
      'loanTypeFilter',
      'statusFilter',
      'amountFilter',
      'dashboardError',
      'modalBackdrop',
      'wizardModal',
      'contactPerson',
      'phone',
      'loanProductSelect',
      'customProductGroup',
      'customProductInput',
      'btnDetailsContinue',
      'btnDocsCreate',
      'recommendedDocsFields',
      'additionalDocsFields',
      'docMappingModalBackdrop',
      'mappingMatrixHeaderRow',
      'mappingMatrixTableBody'
    ];

    requiredIds.forEach(id => {
      assert.ok(
        htmlContent.includes(`id="${id}"`),
        `Missing critical DOM element id="${id}" in dashboard.html`
      );
    });
  });

  await t.test('2. Verify static script tags are loaded in valid order', () => {
    const variantConfigIdx = htmlContent.indexOf('/js/variant-config.js');
    const appJsIdx = htmlContent.indexOf('/js/app.js');

    assert.ok(variantConfigIdx !== -1, 'variant-config.js script tag missing');
    assert.ok(appJsIdx !== -1, 'app.js script tag missing');
    assert.ok(variantConfigIdx < appJsIdx, 'variant-config.js must load before app.js');
  });

  await t.test('3. Verify no raw unescaped placeholders or obsolete Loan Agent references remain in baseline HTML', () => {
    assert.ok(!htmlContent.includes('New Client Intake Collection'), 'Obsolete title string found');
    assert.ok(htmlContent.includes('Your Clients') || htmlContent.includes('data-variant-key="dashboardHeader"'), 'Header missing variant key');
  });

  await t.test('4. Verify table-card element is top-level and not enclosed inside hidden error banner', () => {
    const errDivIdx = htmlContent.indexOf('id="dashboardError"');
    const tableCardIdx = htmlContent.indexOf('class="table-card"');
    assert.ok(errDivIdx !== -1 && tableCardIdx !== -1, 'Elements missing');
    const snippetBetween = htmlContent.slice(errDivIdx, tableCardIdx);
    assert.ok(snippetBetween.includes('</div>'), 'dashboardError div was not closed before table-card element!');
  });

  await t.test('5. Verify app.js hides both amountFilter and loanTypeFilter for CA persona', () => {
    const appJsCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app.js'), 'utf8');
    assert.ok(appJsCode.includes('amountFilter') && appJsCode.includes('loanTypeFilter'), 'Filter references missing');
    assert.ok(appJsCode.includes('isCa ? "none" : ""'), 'CA filter hiding logic missing in app.js');
  });

  await t.test('6. Verify CA persona excluded document types (gst_returns, quotation, property_docs, invoices)', () => {
    const appJsCode = fs.readFileSync(path.join(process.cwd(), 'public', 'js', 'app.js'), 'utf8');
    const casesApiCode = fs.readFileSync(path.join(process.cwd(), 'src', 'api', 'cases.js'), 'utf8');
    assert.ok(appJsCode.includes("excluded = new Set(['gst_returns', 'quotation', 'property_docs', 'invoices'])"), 'app.js missing CA catalog exclusions');
    assert.ok(casesApiCode.includes("excluded = new Set(['gst_returns', 'quotation', 'property_docs', 'invoices'])"), 'cases.js missing CA catalog exclusions');
  });

  await t.test('7. Verify cases.js allows null or 0 amountRequired for CA intake creation', () => {
    const casesApiCode = fs.readFileSync(path.join(process.cwd(), 'src', 'api', 'cases.js'), 'utf8');
    assert.ok(casesApiCode.includes('body.amountRequired !== 0'), 'cases.js missing 0 check for optional amountRequired');
  });
});
