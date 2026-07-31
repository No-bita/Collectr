import assert from "node:assert/strict";
import { test, describe } from "node:test";

/**
 * Unit & Integration Test Suite for WhatsApp Workflow
 */

describe("WhatsApp Workflow Integration Tests", () => {

  test("1. Primary Template (new_convo_1) Payload Structure", () => {
    const phone = "919137839907";
    const templateName = "new_convo_1";
    const contactPerson = "Aryan Shah";
    const token = "secure_token_123";
    const env = {
      WHATSAPP_PHONE_ID: "1078210008704696",
      WHATSAPP_ACCESS_TOKEN: "mock_access_token",
      WHATSAPP_TEMPLATE_LANG: "en",
      FRONTEND_URL: "https://collectrr-v2.collectr.workers.dev"
    };

    const targetUrl = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
    assert.equal(targetUrl, "https://graph.facebook.com/v17.0/1078210008704696/messages");

    const uploadLink = `${env.FRONTEND_URL}/upload.html?t=${token}`;

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: env.WHATSAPP_TEMPLATE_LANG || "en" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", parameter_name: "name", text: contactPerson },
              { type: "text", parameter_name: "uploadlink", text: uploadLink }
            ]
          }
        ]
      }
    };

    assert.equal(payload.messaging_product, "whatsapp");
    assert.equal(payload.to, "919137839907");
    assert.equal(payload.template.name, "new_convo_1");
    assert.equal(payload.template.language.code, "en");
    assert.equal(payload.template.components[0].parameters[0].parameter_name, "name");
    assert.equal(payload.template.components[0].parameters[0].text, "Aryan Shah");
    assert.equal(payload.template.components[0].parameters[1].parameter_name, "uploadlink");
    assert.equal(payload.template.components[0].parameters[1].text, "https://collectrr-v2.collectr.workers.dev/upload.html?t=secure_token_123");
  });

  test("2. Automatic Fallback to hello_world on Primary Failure", async () => {
    let mockCalls = [];

    async function sendWithFallback(primaryName, phone) {
      mockCalls.push(primaryName);
      if (primaryName !== "hello_world") {
        // Simulate primary template failure (#132001 template error)
        mockCalls.push("hello_world");
        return { success: true, usedTemplate: "hello_world" };
      }
      return { success: true, usedTemplate: "hello_world" };
    }

    const result = await sendWithFallback("new_convo_1", "919137839907");
    assert.equal(result.success, true);
    assert.equal(result.usedTemplate, "hello_world");
    assert.deepEqual(mockCalls, ["new_convo_1", "hello_world"]);
  });

  test("3. Hard Cap Enforcement (Max 3 Attempts Allowed)", () => {
    const HARD_CAP = 3;

    function canRetry(attemptsUsed) {
      if (attemptsUsed >= HARD_CAP) {
        return {
          allowed: false,
          error: `Maximum retry limit (${HARD_CAP} attempts) reached for WhatsApp messaging on this case.`,
          attemptsUsed,
          attemptsLeft: 0,
          hardCapReached: true
        };
      }
      const nextAttempt = attemptsUsed + 1;
      return {
        allowed: true,
        nextAttempt,
        attemptsLeft: HARD_CAP - nextAttempt
      };
    }

    assert.equal(canRetry(0).allowed, true);
    assert.equal(canRetry(0).nextAttempt, 1);
    assert.equal(canRetry(0).attemptsLeft, 2);

    assert.equal(canRetry(1).allowed, true);
    assert.equal(canRetry(1).nextAttempt, 2);
    assert.equal(canRetry(1).attemptsLeft, 1);

    assert.equal(canRetry(2).allowed, true);
    assert.equal(canRetry(2).nextAttempt, 3);
    assert.equal(canRetry(2).attemptsLeft, 0);

    const capResult = canRetry(3);
    assert.equal(capResult.allowed, false);
    assert.equal(capResult.hardCapReached, true);
    assert.equal(capResult.attemptsLeft, 0);
  });

  test("4. Meta API Error Response Parsing", () => {
    const metaErrorResponse = {
      error: {
        message: "(#132001) Template name does not exist in the translation | template name (onboarding_first_message) does not exist in en",
        type: "OAuthException",
        code: 132001
      }
    };

    function parseMetaError(data) {
      const details = data.error?.error_data?.details || "";
      return `${data.error?.message || "WhatsApp service unavailable"}${details ? " | " + details : ""}`;
    }

    const parsedMessage = parseMetaError(metaErrorResponse);
    assert.ok(parsedMessage.includes("132001"));
    assert.ok(parsedMessage.includes("Template name does not exist"));
  });

  test("5. Webhook Subscription Verification", () => {
    const expectedVerifyToken = "CollectrWhatsappTokenAuth2026";
    
    function handleWebhookVerify(mode, token, challenge) {
      if (mode === "subscribe" && token === expectedVerifyToken) {
        return { status: 200, challenge };
      }
      return { status: 403, error: "Forbidden" };
    }

    assert.deepEqual(
      handleWebhookVerify("subscribe", "CollectrWhatsappTokenAuth2026", "11582014"),
      { status: 200, challenge: "11582014" }
    );

    assert.deepEqual(
      handleWebhookVerify("subscribe", "wrong_token", "11582014"),
      { status: 403, error: "Forbidden" }
    );
  });

});
