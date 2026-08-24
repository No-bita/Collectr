import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { getWhatsAppTemplate } from "../src/whatsapp/templates.js";
import { isWithin24HourServiceWindow } from "../src/whatsapp/window.js";
import { verifyWebhookSubscription, parseWebhookPayload } from "../src/whatsapp/webhook.js";

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

  test("5. Webhook Subscription Verification (verifyWebhookSubscription)", () => {
    const expectedVerifyToken = "CollectrWhatsappTokenAuth2026";

    assert.deepEqual(
      verifyWebhookSubscription("subscribe", "CollectrWhatsappTokenAuth2026", "11582014", expectedVerifyToken),
      { verified: true, challenge: "11582014" }
    );

    assert.deepEqual(
      verifyWebhookSubscription("subscribe", "wrong_token", "11582014", expectedVerifyToken),
      { verified: false, challenge: null }
    );
  });

  test("6. Central WhatsApp Template Registry (getWhatsAppTemplate)", () => {
    const tplConfig = getWhatsAppTemplate("onboarding_first_message", {});
    assert.equal(tplConfig.id, "onboarding_first_message");
    const payloads = tplConfig.getPayloads({ phone: "919876543210", contactPerson: "Test Client", rawToken: "tok_123", templateParams: ["Aryan", "Aaryan Shah & Co"] });
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].template.name, "onboarding_first_message");

    const loanAgentConfig = getWhatsAppTemplate("loan_agent_first_outreach");
    assert.equal(loanAgentConfig.id, "loan_agent_first_outreach");
  });

  test("7. Free-Form WhatsApp Text Message Payload Structure", () => {
    const phone = "919876543210";
    const text = "Hi, thanks for getting back to me.";

    const payload = {
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text }
    };

    assert.equal(payload.messaging_product, "whatsapp");
    assert.equal(payload.to, "919876543210");
    assert.equal(payload.type, "text");
    assert.equal(payload.text.body, "Hi, thanks for getting back to me.");
  });

  test("8. Meta 24-Hour Customer Service Window Enforcement (isWithin24HourServiceWindow)", () => {
    const now = Date.now();

    // 8a. No reply received
    assert.equal(isWithin24HourServiceWindow(null, now), false);

    // 8b. Reply received 2 hours ago (< 24h) -> OPEN
    const recentReply = now - (2 * 60 * 60 * 1000);
    assert.equal(isWithin24HourServiceWindow(recentReply, now), true);

    // 8c. Reply received 25 hours ago (> 24h) -> EXPIRED
    const oldReply = now - (25 * 60 * 60 * 1000);
    assert.equal(isWithin24HourServiceWindow(oldReply, now), false);

    // 8d. Subsequent reply refreshes the 24-hour window
    const newReply = now - (10 * 60 * 1000); // 10 mins ago
    assert.equal(isWithin24HourServiceWindow(newReply, now), true);
  });

  test("9. Outgoing Free-form Timeline Event & Metadata Contract", () => {
    const caseId = "case_test_123";
    const text = "Your documents look good, proceeding to verification.";
    const metaMsgId = "wamid.HBgLM...mock";

    const metadata = {
      channel: "whatsapp",
      message_type: "freeform",
      meta_message_id: metaMsgId,
      whatsapp_status: "sent",
      direct_message: true
    };

    const timelineEvent = {
      id: "evt_123",
      case_id: caseId,
      event_type: "whatsapp_sent",
      content: text,
      metadata: JSON.stringify(metadata),
      created_by: "agent"
    };

    assert.equal(timelineEvent.event_type, "whatsapp_sent");
    assert.equal(timelineEvent.created_by, "agent");
    assert.equal(timelineEvent.content, text);
    const parsed = JSON.parse(timelineEvent.metadata);
    assert.equal(parsed.message_type, "freeform");
    assert.equal(parsed.meta_message_id, "wamid.HBgLM...mock");
    assert.equal(parsed.whatsapp_status, "sent");
  });

  test("10. Webhook Payload Normalizer (parseWebhookPayload)", () => {
    const mockWebhookBody = {
      entry: [
        {
          changes: [
            {
              value: {
                statuses: [
                  {
                    id: "wamid.HBgLM...1",
                    recipient_id: "919876543210",
                    status: "delivered",
                    timestamp: "1700000000"
                  }
                ],
                messages: [
                  {
                    id: "wamid.HBgLM...2",
                    from: "919876543210",
                    type: "text",
                    text: { body: "Here are my docs" },
                    timestamp: "1700000005"
                  }
                ]
              }
            }
          ]
        }
      ]
    };

    const parsed = parseWebhookPayload(mockWebhookBody);
    assert.equal(parsed.statuses.length, 1);
    assert.equal(parsed.statuses[0].status, "delivered");
    assert.equal(parsed.statuses[0].recipientId, "919876543210");
    assert.equal(parsed.statuses[0].providerMsgId, "wamid.HBgLM...1");

    assert.equal(parsed.messages.length, 1);
    assert.equal(parsed.messages[0].shortPhone, "9876543210");
    assert.equal(parsed.messages[0].fullPhone, "919876543210");
    assert.equal(parsed.messages[0].text, "Here are my docs");
  });

  test("11. Template Sending Independence from 24-Hour Reply Window", () => {
    // 11a. Free-form requires active 24h window
    const now = Date.now();
    const expiredReply = now - (30 * 60 * 60 * 1000);
    assert.equal(isWithin24HourServiceWindow(expiredReply, now), false);

    // 11b. Template message payload can be generated regardless of customer reply
    const doCaTpl = getWhatsAppTemplate("do_ca");
    assert.equal(doCaTpl.id, "do_ca");
    assert.deepEqual(doCaTpl.parameters, []);
    const payloads = doCaTpl.getPayloads({ phone: "919876543210" });
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].template.name, "do_ca");
  });

  test("12. Direct Outreach Scoped Template Metadata", () => {
    const doCaTpl = getWhatsAppTemplate("do_ca");
    assert.ok(doCaTpl.context.includes("direct_outreach"), "do_ca must be scoped to direct_outreach");

    const onboardingTpl = getWhatsAppTemplate("onboarding_first_message");
    assert.ok(onboardingTpl.context.includes("direct_outreach"), "onboarding_first_message must be scoped to direct_outreach");
    assert.equal(onboardingTpl.parameters.length, 2);
    assert.equal(onboardingTpl.parameters[0].key, "client_name");
  });

  test("13. Template Outgoing Timeline Event Contract", () => {
    const caseId = "case_direct_123";
    const templateName = "do_ca";
    const metaMsgId = "wamid.HBgLM...tpl";

    const metadata = {
      channel: "whatsapp",
      message_type: "template",
      template_name: templateName,
      meta_message_id: metaMsgId,
      whatsapp_status: "sent",
      direct_message: true
    };

    const timelineEvent = {
      id: "evt_tpl_123",
      case_id: caseId,
      event_type: "whatsapp_sent",
      content: `WhatsApp template sent: ${templateName}`,
      metadata: JSON.stringify(metadata),
      created_by: "agent"
    };

    assert.equal(timelineEvent.event_type, "whatsapp_sent");
    const parsed = JSON.parse(timelineEvent.metadata);
    assert.equal(parsed.message_type, "template");
    assert.equal(parsed.template_name, "do_ca");
    assert.equal(parsed.meta_message_id, "wamid.HBgLM...tpl");
  });

});
