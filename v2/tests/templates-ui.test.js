import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { getWhatsAppTemplate, buildCustomTemplatePayload, WHATSAPP_TEMPLATES } from '../src/whatsapp/templates.js';

const rootDir = path.resolve(process.cwd());

test('Message Templates UI & Modal Engine Tests', async (t) => {

  await t.test('1. DOM Elements & Modal Structure in dashboard.html', () => {
    const htmlPath = path.join(rootDir, 'public', 'dashboard.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(htmlContent.includes('id="btnOpenTemplateModal"'), 'btnOpenTemplateModal trigger button must exist');
    assert.ok(htmlContent.includes('id="templateModalBackdrop"'), 'templateModalBackdrop modal must exist');
    assert.ok(htmlContent.includes('id="tabTplList"'), 'tabTplList tab button must exist');
    assert.ok(htmlContent.includes('id="tabTplCreate"'), 'tabTplCreate tab button must exist');
    assert.ok(htmlContent.includes('id="tplListView"'), 'tplListView container must exist');
    assert.ok(htmlContent.includes('id="tplCreateView"'), 'tplCreateView container must exist');
    assert.ok(htmlContent.includes('id="tplNameInput"'), 'tplNameInput must exist');
    assert.ok(htmlContent.includes('id="tplCategorySelect"'), 'tplCategorySelect must exist');
    assert.ok(htmlContent.includes('id="tplLangSelect"'), 'tplLangSelect must exist');
    assert.ok(htmlContent.includes('id="tplHeaderTypeSelect"'), 'tplHeaderTypeSelect must exist');
    assert.ok(htmlContent.includes('id="tplHeaderInput"'), 'tplHeaderInput must exist');
    assert.ok(htmlContent.includes('id="tplBodyInput"'), 'tplBodyInput must exist');
    assert.ok(htmlContent.includes('id="tplFooterInput"'), 'tplFooterInput must exist');
    assert.ok(htmlContent.includes('id="tplButtonTypeSelect"'), 'tplButtonTypeSelect must exist');
    assert.ok(htmlContent.includes('id="tplButtonTextInput"'), 'tplButtonTextInput must exist');
    assert.ok(htmlContent.includes('id="tplLiveHeader"'), 'Live preview header container must exist');
    assert.ok(htmlContent.includes('id="tplLivePreviewText"'), 'Live preview text container must exist');
    assert.ok(htmlContent.includes('id="tplLiveFooter"'), 'Live preview footer container must exist');
    assert.ok(htmlContent.includes('id="btnSaveTemplate"'), 'btnSaveTemplate submit button must exist');
  });

  await t.test('2. CSS Stylesheet Rules for Live Preview & Modal', () => {
    const cssPath = path.join(rootDir, 'public', 'css', 'dashboard.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.template-modal-layout'), '.template-modal-layout rule must exist');
    assert.ok(cssContent.includes('.whatsapp-preview-container'), '.whatsapp-preview-container rule must exist');
    assert.ok(cssContent.includes('.whatsapp-bubble'), '.whatsapp-bubble rule must exist');
    assert.ok(cssContent.includes('.tpl-tabs'), '.tpl-tabs rule must exist');
    assert.ok(cssContent.includes('.tpl-tab-btn'), '.tpl-tab-btn rule must exist');
  });

  await t.test('3. JavaScript Logic & Admin-Scoping in app.js', () => {
    const jsPath = path.join(rootDir, 'public', 'js', 'app.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(jsContent.includes('btnTemplate.style.display = isAdmin ? \'\' : \'none\';'), 'Template modal button must only be shown for admin account');
    assert.ok(jsContent.includes('function openTemplateModal'), 'openTemplateModal must be defined');
    assert.ok(jsContent.includes('function closeTemplateModal'), 'closeTemplateModal must be defined');
    assert.ok(jsContent.includes('function switchTemplateTab'), 'switchTemplateTab must be defined');
    assert.ok(jsContent.includes('function updateTemplateLivePreview'), 'updateTemplateLivePreview must be defined');
    assert.ok(jsContent.includes('function saveCustomTemplate'), 'saveCustomTemplate must be defined');
    assert.ok(jsContent.includes('function editCustomTemplate'), 'editCustomTemplate must be defined');
    assert.ok(jsContent.includes('function deleteCustomTemplate'), 'deleteCustomTemplate must be defined');
  });

  await t.test('4. Dynamic Multi-Component Template Payload Generation for Custom Templates', () => {
    const customTpl = {
      id: "tpl_test_custom",
      name: "tax_reminder_2026",
      category: "UTILITY",
      language: "hi",
      header_type: "TEXT",
      header_text: "ITR Verification",
      body_text: "Namaste {{1}}, please send docs for {{3}} via {{2}}",
      footer_text: "Collectrr Tax Dept",
      button_type: "url",
      button_text: "Upload Documents",
      param_mappings: {
        header: ["contact_person"],
        body: ["contact_person", "upload_link", "loan_product"],
        button: ["raw_token"]
      }
    };

    const payloads = buildCustomTemplatePayload(customTpl, {
      phone: "919876543210",
      contactPerson: "Aryan",
      rawToken: "token_abc_123",
      uploadLink: "https://collectrr-v2.collectr.workers.dev/upload.html?t=token_abc_123",
      loanProduct: "ITR Filing"
    });

    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].to, "919876543210");
    assert.equal(payloads[0].template.name, "tax_reminder_2026");
    assert.equal(payloads[0].template.language.code, "hi");

    // Header component
    assert.equal(payloads[0].template.components[0].type, "header");
    assert.equal(payloads[0].template.components[0].parameters[0].text, "Aryan");

    // Body component
    assert.equal(payloads[0].template.components[1].type, "body");
    assert.equal(payloads[0].template.components[1].parameters[0].text, "Aryan");
    assert.equal(payloads[0].template.components[1].parameters[1].text, "https://collectrr-v2.collectr.workers.dev/upload.html?t=token_abc_123");
    assert.equal(payloads[0].template.components[1].parameters[2].text, "ITR Filing");

    // Button component
    assert.equal(payloads[0].template.components[2].type, "button");
    assert.equal(payloads[0].template.components[2].parameters[0].text, "token_abc_123");
  });

  await t.test('5. Dynamic Registry Lookup via getWhatsAppTemplate', () => {
    const customList = [
      {
        id: "tpl_doc_req",
        name: "custom_doc_request",
        language: "hi",
        category: "UTILITY",
        body_text: "Namaste {{1}}, kripya documents upload karein {{2}}",
        button_type: "url"
      }
    ];

    const resolved = getWhatsAppTemplate("custom_doc_request", {}, customList);
    assert.equal(resolved.name, "custom_doc_request");
    assert.equal(resolved.defaultLang, "hi");
    assert.equal(typeof resolved.getPayloads, "function");

    // Test system fallback for built-in templates
    const fallback = getWhatsAppTemplate("onboarding_first_message", {});
    assert.equal(fallback.name, "onboarding_first_message");
  });
});
