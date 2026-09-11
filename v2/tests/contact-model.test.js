import test from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { normalizeIndianPhoneNumber } from "../src/whatsapp/client.js";
import { renderTemplateBody } from "../src/whatsapp/templates.js";
import { parseWebhookPayload, verifyWebhookSubscription } from "../src/whatsapp/webhook.js";

test("Contact, Mini Target & Unified WhatsApp Architecture Tests", async (t) => {

  // 1. Phone Number Normalization Specification
  await t.test("1. Phone Number Normalization handles all valid Indian formats and rejects invalid numbers", () => {
    // 10 digits
    assert.strictEqual(normalizeIndianPhoneNumber("9876543210"), "919876543210");
    assert.strictEqual(normalizeIndianPhoneNumber(9876543210), "919876543210");

    // Leading 0
    assert.strictEqual(normalizeIndianPhoneNumber("09876543210"), "919876543210");

    // 12 digits with 91 prefix
    assert.strictEqual(normalizeIndianPhoneNumber("919876543210"), "919876543210");

    // Non-digit characters: spaces, hyphens, plus signs, brackets
    assert.strictEqual(normalizeIndianPhoneNumber("+91 98765-43210"), "919876543210");
    assert.strictEqual(normalizeIndianPhoneNumber("+91 (98765) 43210"), "919876543210");
    assert.strictEqual(normalizeIndianPhoneNumber("  098765 43210  "), "919876543210");

    // Invalid inputs throw actionable errors
    assert.throws(() => normalizeIndianPhoneNumber("12345"), /valid 10-digit Indian mobile number/);
    assert.throws(() => normalizeIndianPhoneNumber(""), /valid 10-digit Indian mobile number/);
    assert.throws(() => normalizeIndianPhoneNumber("98765432109876"), /valid 10-digit Indian mobile number/);
    assert.throws(() => normalizeIndianPhoneNumber("abcdefghij"), /valid 10-digit Indian mobile number/);
    assert.throws(() => normalizeIndianPhoneNumber(null), /valid 10-digit Indian mobile number/);
  });

  // 2. Exact Rendered Body Persistence
  await t.test("2. renderTemplateBody renders exact Meta template texts without leakage or reconstruction", () => {
    // onboarding_first_message
    const body1 = renderTemplateBody("onboarding_first_message", {
      contactPerson: "Ramesh Sharma",
      userName: "Shah & Associates",
      templateParams: ["Ramesh Sharma", "Shah & Associates"]
    });
    assert.ok(body1.includes("Hi Ramesh Sharma,"), "Missing client name");
    assert.ok(body1.includes("Thank you for trusting Shah & Associates."), "Missing CA name");
    assert.ok(body1.includes("To get started with your ITR filing"), "Missing body text");
    assert.ok(!body1.includes("{{"), "Body contains raw template variables");

    // loan_agent_first_outreach
    const body2 = renderTemplateBody("loan_agent_first_outreach", {
      contactPerson: "Anita Roy",
      userName: "Apex Finance",
      userPhone: "+91 9876543210",
      templateParams: ["Anita Roy", "Apex Finance", "+91 9876543210"]
    });
    assert.ok(body2.includes("Namaste Anita Roy,"), "Missing borrower name");
    assert.ok(body2.includes("Loan application has been initiated by Apex Finance."), "Missing agent name");
    assert.ok(body2.includes("+91 9876543210"), "Missing contact phone");
    assert.ok(!body2.includes("{{"), "Body contains raw template variables");

    // do_ca (Direct Outreach Gujarati/English)
    const body3 = renderTemplateBody("do_ca");
    assert.ok(body3.includes("Kem cho?"), "Missing greeting");
    assert.ok(body3.includes("I came across your firm on Google"), "Missing body text");
    assert.ok(!body3.includes("{{"), "Body contains raw template variables");
  });

  // 3. Webhook Parsing & Tenant Resolution Contract
  await t.test("3. Webhook Parser extracts Meta Business Phone ID, profile names and delivery status updates", () => {
    const rawWebhookPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "WABA_12345",
          changes: [
            {
              value: {
                messaging_product: "whatsapp",
                metadata: {
                  display_phone_number: "919999999999",
                  phone_number_id: "WABA_PHONE_ID_001"
                },
                contacts: [
                  {
                    profile: { name: "Sunil Verma" },
                    wa_id: "919876543210"
                  }
                ],
                messages: [
                  {
                    from: "919876543210",
                    id: "wamid.HBgLMTIzNDU2",
                    timestamp: "1724500000",
                    text: { body: "Sent the documents" },
                    type: "text"
                  }
                ],
                statuses: [
                  {
                    id: "wamid.HBgLMzg3NjU0",
                    status: "delivered",
                    timestamp: "1724500005",
                    recipient_id: "919876543210"
                  }
                ]
              },
              field: "messages"
            }
          ]
        }
      ]
    };

    const parsed = parseWebhookPayload(rawWebhookPayload);
    assert.strictEqual(parsed.messages.length, 1);
    assert.strictEqual(parsed.messages[0].phoneNumberId, "WABA_PHONE_ID_001");
    assert.strictEqual(parsed.messages[0].profileName, "Sunil Verma");
    assert.strictEqual(parsed.messages[0].text, "Sent the documents");
    assert.strictEqual(parsed.messages[0].messageId, "wamid.HBgLMTIzNDU2");

    assert.strictEqual(parsed.statuses.length, 1);
    assert.strictEqual(parsed.statuses[0].providerMsgId, "wamid.HBgLMzg3NjU0");
    assert.strictEqual(parsed.statuses[0].status, "delivered");
    assert.strictEqual(parsed.statuses[0].phoneNumberId, "WABA_PHONE_ID_001");
  });

  // 4. Multi-Tenancy & Schema Verification
  await t.test("4. Migration 0006 and schema.sql enforce multi-tenancy constraints and column additions", () => {
    const migrationSql = fs.readFileSync(path.join(process.cwd(), "migrations", "0006_contacts_and_mini_targets.sql"), "utf8");
    const masterSchemaSql = fs.readFileSync(path.join(process.cwd(), "src", "db", "schema.sql"), "utf8");

    // UNIQUE(user_id, phone_number) on contacts
    assert.ok(migrationSql.includes("CONSTRAINT unq_user_contact_phone UNIQUE(user_id, phone_number)"), "Missing user_id scoped contact uniqueness in migration 0006");
    assert.ok(masterSchemaSql.includes("CONSTRAINT unq_user_contact_phone UNIQUE(user_id, phone_number)"), "Missing user_id scoped contact uniqueness in schema.sql");

    // users.wa_phone_number_id
    assert.ok(migrationSql.includes("wa_phone_number_id"), "Missing wa_phone_number_id in migration 0006");
    assert.ok(masterSchemaSql.includes("wa_phone_number_id"), "Missing wa_phone_number_id in schema.sql");

    // loan_cases.contact_id
    assert.ok(migrationSql.includes("contact_id"), "Missing contact_id in migration 0006");
    assert.ok(masterSchemaSql.includes("contact_id"), "Missing contact_id in schema.sql");

    // case_timeline provider_message_id and indexes
    assert.ok(migrationSql.includes("provider_message_id"), "Missing provider_message_id in migration 0006");
    assert.ok(masterSchemaSql.includes("unq_timeline_provider_msg"), "Missing unq_timeline_provider_msg index in schema.sql");
  });

  // 5. Backend Endpoints Registration
  await t.test("5. Endpoint routing in index.js includes duplicate check and bulk preview routes", () => {
    const indexJs = fs.readFileSync(path.join(process.cwd(), "src", "index.js"), "utf8");
    assert.ok(indexJs.includes("/api/contacts/check"), "Missing /api/contacts/check route");
    assert.ok(indexJs.includes("/api/cases/bulk-import/preview"), "Missing /api/cases/bulk-import/preview route");
    assert.ok(indexJs.includes("/api/contacts/:id"), "Missing /api/contacts/:id route");
  });

  // 6. Frontend Duplicate Modal & Confirmation UI
  await t.test("6. dashboard.html and app.js implement the interactive Duplicate Contact Confirmation flow", () => {
    const dashboardHtml = fs.readFileSync(path.join(process.cwd(), "public", "dashboard.html"), "utf8");
    const appJs = fs.readFileSync(path.join(process.cwd(), "public", "js", "app.js"), "utf8");

    assert.ok(dashboardHtml.includes("duplicateConfirmModalBackdrop"), "Missing duplicateConfirmModalBackdrop in dashboard.html");
    assert.ok(dashboardHtml.includes("Contact already exists"), "Missing modal heading in dashboard.html");
    assert.ok(dashboardHtml.includes("btnProceedDuplicateConfirm"), "Missing confirm button in dashboard.html");

    assert.ok(appJs.includes("checkContactDuplicate"), "Missing checkContactDuplicate in app.js");
    assert.ok(appJs.includes("promptDuplicateContactConfirm"), "Missing promptDuplicateContactConfirm in app.js");
  });

  // 7. Case Detail Exact Message Rendering
  await t.test("7. case-detail.js renders exact persisted message bodies with Mini Target attribution", () => {
    const caseDetailJs = fs.readFileSync(path.join(process.cwd(), "public", "js", "case-detail.js"), "utf8");
    assert.ok(caseDetailJs.includes("const messageText = t.content || \"Message sent\";"), "case-detail.js not using t.content directly");
    assert.ok(caseDetailJs.includes("miniTargetAttr"), "case-detail.js missing Mini Target attribution rendering");
  });
});
