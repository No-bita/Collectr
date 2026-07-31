import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve(process.cwd());

test('3-Screen Creation Wizard UI & Architecture Tests', async (t) => {
  await t.test('1. HTML Markup Structure Verification', () => {
    const htmlPath = path.join(rootDir, 'public', 'index.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes('id="wizardModal"'), 'wizardModal element must exist');
    assert.ok(htmlContent.includes('data-active-screen="details"'), 'Default active screen must be details');
    assert.ok(htmlContent.includes('data-screen="details"'), 'Screen 1 (details) must exist');
    assert.ok(htmlContent.includes('data-screen="documents"'), 'Screen 2 (documents) must exist');
    assert.ok(htmlContent.includes('data-screen="success"'), 'Screen 3 (success) must exist');
    assert.ok(htmlContent.includes('class="form-row-2col"'), 'Name and phone must be grouped in a 2-column row');
    assert.ok(htmlContent.includes('id="amountRequired"'), 'amountRequired input field must exist on Screen 1');
    assert.ok(!htmlContent.includes('expectation-card'), 'Expectation card must be deleted');
    assert.ok(!htmlContent.includes('liveDocPreviewContainer'), 'Live doc preview container must be removed from Screen 1');
    assert.ok(!htmlContent.includes('integration-teaser-box'), 'Automated integrations section must be deleted');
    assert.ok(!htmlContent.includes('placeholder="e.g.'), 'Input placeholders must not use e.g. prefix');
  });

  await t.test('2. CSS Stylesheet Rules Verification', () => {
    const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.wizard-modal'), '.wizard-modal class rule must exist');
    assert.ok(cssContent.includes('background: #ffffff'), '.wizard-modal must have background: #ffffff');
    assert.ok(cssContent.includes('[data-active-screen="details"]'), 'Details screen width rule must exist');
    assert.ok(cssContent.includes('max-width: 640px'), 'Details screen max-width must be 640px');
    assert.ok(cssContent.includes('[data-active-screen="documents"]'), 'Documents screen width rule must exist');
    assert.ok(cssContent.includes('max-width: 720px'), 'Documents screen max-width must be 720px');
    assert.ok(cssContent.includes('[data-active-screen="success"]'), 'Success screen width rule must exist');
    assert.ok(cssContent.includes('max-width: 560px'), 'Success screen max-width must be 560px');
    assert.ok(cssContent.includes('.form-row-2col'), '.form-row-2col class rule must exist');
    assert.ok(cssContent.includes('::-webkit-inner-spin-button'), 'Number input spinner hiding rule must exist');
    assert.ok(cssContent.includes('.doc-card-item'), 'doc-card-item class rule must exist');
    assert.ok(cssContent.includes('.doc-badge-recommended'), 'doc-badge-recommended class rule must exist');
  });

  await t.test('3. JavaScript Wizard State Machine Verification', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('let wizardState'), 'wizardState object must be defined');
    assert.ok(jsContent.includes('function setWizardScreen'), 'setWizardScreen function must be defined');
    assert.ok(jsContent.includes('function getRecommendedDocsForProduct'), 'getRecommendedDocsForProduct helper must be defined');
    assert.ok(jsContent.includes('function updateLiveDocPreview'), 'updateLiveDocPreview helper must be defined');
    assert.ok(jsContent.includes('btnDetailsContinue'), 'btnDetailsContinue listener must exist');
    assert.ok(jsContent.includes('btnDocsCreate'), 'btnDocsCreate listener must exist');
  });

  await t.test('4. Mobile Number 10-Digit Validation Logic', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('/^\\d{10}$/'), 'Must validate exactly 10 digits using regex');
    assert.ok(jsContent.includes('input-error'), 'Must apply input-error class on invalid phone');
    assert.ok(jsContent.includes('Please enter a valid 10-digit mobile number'), 'Must display actionable 10-digit error');
  });

  await t.test('5. Contact Person Name Special Character Filtering', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('[^a-zA-Z\\s.\\-]'), 'Must sanitize special characters using regex');
    assert.ok(jsContent.includes('Please enter a valid name using letters and spaces only'), 'Must show actionable error for invalid characters');
  });
});
