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

  await t.test('6. Template Uniqueness and Protection from duplicate names', async () => {
    const { handleCreateTemplate, handleGetTemplates } = await import('../src/api/templates.js');

    const createMockContext = ({ body = {}, query = {}, dbRows = [], user = { id: "admin" } } = {}) => {
      const executed = [];
      const mockDb = {
        prepare: (sql) => {
          let boundArgs = [];
          return {
            bind: (...args) => {
              boundArgs = args;
              return {
                all: async () => {
                  executed.push({ sql, args: boundArgs });
                  return { results: dbRows };
                },
                run: async () => {
                  executed.push({ sql, args: boundArgs });
                  return { success: true };
                }
              };
            },
            all: async () => {
              executed.push({ sql, args: boundArgs });
              return { results: dbRows };
            },
            run: async () => {
              executed.push({ sql, args: boundArgs });
              return { success: true };
            }
          };
        }
      };

      return {
        c: {
          env: { DB: mockDb },
          get: (k) => (k === "user" ? user : null),
          req: {
            query: (k) => query[k] || "",
            json: async () => body,
          },
          json: (data, status = 200) => ({ status, data })
        },
        executed
      };
    };

    // A. Verify handleCreateTemplate rejects colliding with built-in system template (e.g. do_ca)
    const { c: cSystemDup } = createMockContext({
      body: {
        name: "do_ca",
        body_text: "Duplicate do_ca template body",
        language: "en"
      }
    });
    const resSystemDup = await handleCreateTemplate(cSystemDup);
    assert.equal(resSystemDup.status, 409);
    assert.ok(resSystemDup.data.error.includes("already exists as a protected system template"));

    // B. Verify handleCreateTemplate rejects colliding with an existing custom template
    const { c: cCustomDup } = createMockContext({
      body: {
        name: "my_custom_reminder",
        body_text: "Reminder text",
        language: "en"
      },
      dbRows: [{ id: "tpl_existing_123", name: "my_custom_reminder" }]
    });
    const resCustomDup = await handleCreateTemplate(cCustomDup);
    assert.equal(resCustomDup.status, 409);
    assert.ok(resCustomDup.data.error.includes("Template names must be unique"));

    // C. Verify handleGetTemplates deduplicates templates and purges duplicate do_ca
    const { c: cGet, executed } = createMockContext({
      query: { context: "direct_outreach" },
      dbRows: [
        // Suppose a duplicate do_ca somehow existed in the DB
        {
          id: "tpl_legacy_do_ca",
          name: "do_ca",
          body_text: "Legacy duplicate do_ca",
          language: "en",
          is_active: 1
        },
        // And a valid custom template
        {
          id: "tpl_valid_custom",
          name: "unique_outreach_custom",
          body_text: "Custom outreach {{1}}",
          language: "en",
          is_active: 1
        }
      ]
    });

    const resGet = await handleGetTemplates(cGet);
    assert.equal(resGet.status, 200);
    assert.equal(resGet.data.success, true);

    // Verify purge SQL was executed for system template names
    const purgeQuery = executed.find(e => e.sql.includes("DELETE FROM message_templates WHERE LOWER(name) IN"));
    assert.ok(purgeQuery, "handleGetTemplates must execute cleanup SQL purging duplicate system templates");

    // Verify template names in returned list are strictly unique
    const returnedNames = resGet.data.templates.map(t => t.name.toLowerCase());
    const nameSet = new Set(returnedNames);
    assert.equal(returnedNames.length, nameSet.size, "Templates returned by handleGetTemplates must never contain duplicate names");

    // Verify do_ca only appears once in the returned templates
    const doCaCount = returnedNames.filter(n => n === "do_ca").length;
    assert.equal(doCaCount, 1, "There must be exactly one do_ca template returned");
  });
});

