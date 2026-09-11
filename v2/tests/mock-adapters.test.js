import "./helpers/network-guard.js";
import test from "node:test";
import assert from "node:assert/strict";
import { sendWhatsAppTemplate, sendWhatsAppText } from "../src/whatsapp/client.js";
import { getWhatsAppTemplate } from "../src/whatsapp/templates.js";
import { runGeminiOcr } from "../src/api/ocr.js";

test("Offline Mock Adapters & Network Isolation Tests", async (t) => {

  await t.test("1. WhatsApp Mock Adapter generates valid wamid without external network calls", async () => {
    const env = {
      MOCK_WHATSAPP: "true",
      MOCK_WHATSAPP_STATUS: "sent",
      WHATSAPP_PHONE_ID: "mock_phone_123"
    };

    const templateConfig = getWhatsAppTemplate("onboarding_first_message");
    const res = await sendWhatsAppTemplate({
      phone: "919876543210",
      templateConfig,
      templateParams: { contactPerson: "TEST PERSON" },
      env
    });

    assert.equal(res.messaging_product, "whatsapp");
    assert.equal(res.contacts[0].input, "919876543210");
    assert.ok(res.messages[0].id.startsWith("wamid.mock_"));
    assert.equal(res.messages[0].message_status, "sent");

    // Text message mock
    const textRes = await sendWhatsAppText("919876543210", "Hello Test", env);
    assert.equal(textRes.messaging_product, "whatsapp");
    assert.ok(textRes.messages[0].id.startsWith("wamid.mock_"));
    assert.equal(textRes.messages[0].message_status, "sent");
  });

  await t.test("2. WhatsApp Mock Adapter respects MOCK_WHATSAPP_STATUS=failed and throws expected error", async () => {
    const env = {
      MOCK_WHATSAPP: "true",
      MOCK_WHATSAPP_STATUS: "failed",
      WHATSAPP_PHONE_ID: "mock_phone_123"
    };

    const templateConfig = getWhatsAppTemplate("onboarding_first_message");
    await assert.rejects(
      async () => {
        await sendWhatsAppTemplate({
          phone: "919876543210",
          templateConfig,
          templateParams: { contactPerson: "TEST PERSON" },
          env
        });
      },
      /\[Mock WhatsApp\] Template dispatch failed/
    );

    await assert.rejects(
      async () => {
        await sendWhatsAppText("919876543210", "Hello Fail", env);
      },
      /\[Mock WhatsApp\] Text message dispatch failed/
    );
  });

  await t.test("3. Gemini OCR Mock Adapter produces unmistakably synthetic data (TEST PERSON, ABCDE1234F)", async () => {
    const executed = [];
    const mockDb = {
      execute: async ({ sql, args }) => {
        executed.push({ sql, args });
        if (sql.includes("SELECT id FROM required_documents")) {
          return { rows: [] }; // No pending docs
        }
        if (sql.includes("SELECT status FROM loan_cases")) {
          return { rows: [{ status: "documents_pending" }] };
        }
        return { rows: [] };
      }
    };

    const env = {
      MOCK_GEMINI: "true",
      MOCK_GEMINI_MODE: "success"
    };

    await runGeminiOcr("mock_s3_key", "upload_123", "case_abc", env, mockDb);

    const updateDoc = executed.find(e => e.sql.includes("UPDATE uploaded_documents SET ocr_payload"));
    assert.ok(updateDoc, "Must update uploaded_documents with OCR payload");
    assert.equal(updateDoc.args[1], "processed");

    const payload = JSON.parse(updateDoc.args[0]);
    assert.equal(payload.anomaly, false);
    assert.equal(payload.documentType, "PAN");
    assert.equal(payload.fields.pan, "ABCDE1234F");
    assert.equal(payload.fields.name, "TEST PERSON");

    // Verify auto-transition
    const statusUpdate = executed.find(e => e.sql.includes("UPDATE loan_cases SET status = 'ready_for_review'"));
    assert.ok(statusUpdate, "Status should auto-advance to ready_for_review when all documents received");
  });

  await t.test("4. Gemini OCR Mock Adapter gracefully handles anomaly, unsupported, and malformed modes", async () => {
    const executed = [];
    const mockDb = {
      execute: async ({ sql, args }) => {
        executed.push({ sql, args });
        if (sql.includes("SELECT id FROM required_documents")) {
          return { rows: [{ id: "doc_pending_1" }] };
        }
        return { rows: [] };
      }
    };

    // Mode A: anomaly
    await runGeminiOcr("s3_key", "upload_anomaly", "case_1", { MOCK_GEMINI: "true", MOCK_GEMINI_MODE: "anomaly" }, mockDb);
    const anomalyDoc = executed.find(e => e.sql.includes("UPDATE uploaded_documents SET ocr_payload") && e.args[2] === "upload_anomaly");
    assert.equal(anomalyDoc.args[1], "flagged");

    // Mode B: malformed non-JSON
    await runGeminiOcr("s3_key", "upload_malformed", "case_2", { MOCK_GEMINI: "true", MOCK_GEMINI_MODE: "malformed" }, mockDb);
    const malformedDoc = executed.find(e => e.sql.includes("UPDATE uploaded_documents SET ocr_payload") && e.args[2] === "upload_malformed");
    assert.equal(malformedDoc.args[1], "flagged");

    // Mode C: error (upstream down)
    await runGeminiOcr("s3_key", "upload_error", "case_3", { MOCK_GEMINI: "true", MOCK_GEMINI_MODE: "error" }, mockDb);
    const errorDoc = executed.find(e => e.sql.includes("UPDATE uploaded_documents SET ocr_status = 'failed'") && e.args[0] === "upload_error");
    assert.ok(errorDoc, "Should set status to failed on upstream error");
  });

  await t.test("5. Network Isolation Guard rejects outbound external HTTP calls when NO_EXTERNAL_NETWORK=true", async () => {
    const { enableNetworkGuard, disableNetworkGuard } = await import("./helpers/network-guard.js");
    enableNetworkGuard();

    try {
      await assert.rejects(
        async () => {
          await fetch("https://graph.facebook.com/v17.0/123/messages");
        },
        /\[Network Isolation Error\]/
      );

      await assert.rejects(
        async () => {
          await fetch("https://generativelanguage.googleapis.com/v1beta/models");
        },
        /\[Network Isolation Error\]/
      );
    } finally {
      disableNetworkGuard();
    }
  });
});
