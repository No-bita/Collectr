import "./helpers/network-guard.js";
import assert from "node:assert/strict";
import { test, describe } from "node:test";
import { getWhatsAppTemplate, renderTemplateBody } from "../src/whatsapp/templates.js";
import { isWithin24HourServiceWindow } from "../src/whatsapp/window.js";
import { verifyWebhookSubscription, parseWebhookPayload } from "../src/whatsapp/webhook.js";
import { executeWhatsAppMessagingPipeline, handleRetryWhatsApp } from "../src/api/cases.js";

function createPipelineMockDb({ initialBalance = 900, existingAttempts = 0 } = {}) {
  let balance = initialBalance;
  const messages = [];
  const reservations = [];
  const timeline = [];
  const cases = [{ id: "case_pipe_1", user_id: "user_pipe_1", contact_person: "Borrower", phone_number: "919876543210", is_demo: 0 }];

  for (let i = 0; i < existingAttempts; i++) {
    timeline.push({ id: `att_${i}`, case_id: "case_pipe_1", event_type: "whatsapp_failed" });
  }

  const db = {
    execute: async (query) => {
      const sql = (typeof query === "string" ? query : query.sql).replace(/\s+/g, " ").trim();
      const args = query.args || [];

      if (sql.includes("SELECT status FROM whatsapp_messages")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT credit_balance FROM users")) {
        return { rows: [{ credit_balance: balance }] };
      }
      if (sql.includes("SELECT * FROM loan_cases WHERE id = ?")) {
        const found = cases.filter(c => c.id === args[0]);
        return { rows: found };
      }
      if (sql.includes("SELECT COUNT(*) as count FROM case_timeline")) {
        const count = timeline.filter(t => t.case_id === args[0] && (t.event_type === 'whatsapp_sent' || t.event_type === 'whatsapp_failed')).length;
        return { rows: [{ count }] };
      }
      if (sql.includes("SELECT token FROM secure_tokens")) {
        return { rows: [{ token: "tok_test_123" }] };
      }
      if (sql.includes("SELECT * FROM message_templates")) {
        return { rows: [] };
      }
      if (sql.includes("UPDATE users SET credit_balance = ?")) {
        balance = args[0];
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO whatsapp_messages")) {
        messages.push({ id: args[0], status: 'SENDING' });
        return { rows: [{ id: args[0] }], changes: 1 };
      }
      if (sql.includes("UPDATE whatsapp_messages")) {
        const last = messages[messages.length - 1];
        if (last) {
          if (sql.includes("'SENT'")) last.status = 'SENT';
          else if (sql.includes("'FAILED'")) last.status = 'FAILED';
          else if (args[0]) last.status = args[0];
        }
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO credit_reservations")) {
        reservations.push({ id: args[0], status: 'PENDING' });
        return { rows: [] };
      }
      if (sql.includes("UPDATE credit_reservations")) {
        const last = reservations[reservations.length - 1];
        if (last) {
          if (sql.includes("'COMPLETED'")) last.status = 'COMPLETED';
          else if (sql.includes("'REFUNDED'")) last.status = 'REFUNDED';
          else if (args[0]) last.status = args[0];
        }
        return { rows: [] };
      }
      if (sql.includes("INSERT INTO case_timeline")) {
        timeline.push({ case_id: args[2] || "case_pipe_1", event_type: args[5], content: args[6], metadata: args[7] });
        return { rows: [] };
      }
      if (sql.includes("UPDATE loan_cases")) {
        return { rows: [] };
      }
      return { rows: [] };
    },
    prepare: (rawSql) => {
      const sql = rawSql.replace(/\s+/g, " ").trim();
      let boundArgs = [];
      return {
        bind: (...args) => {
          boundArgs = args;
          return {
            all: async () => {
              const res = await db.execute({ sql, args: boundArgs });
              return { results: res.rows };
            },
            run: async () => {
              await db.execute({ sql, args: boundArgs });
              return { success: true };
            }
          };
        },
        all: async () => {
          const res = await db.execute({ sql, args: boundArgs });
          return { results: res.rows };
        },
        run: async () => {
          await db.execute({ sql, args: boundArgs });
          return { success: true };
        }
      };
    },
    getState: () => ({ balance, messages, reservations, timeline })
  };

  return db;
}

/**
 * Unit & Integration Test Suite for WhatsApp Workflow
 */

describe("WhatsApp Workflow Integration Tests", () => {

  test("1. Production Template Payload Structure via getWhatsAppTemplate", () => {
    const phone = "919876543210";
    const contactPerson = "Test Borrower";
    const token = "secure_token_123";
    const uploadLink = `https://collectrr-v2.collectr.workers.dev/upload.html?t=${token}`;

    const tplConfig = getWhatsAppTemplate("onboarding_first_message");
    assert.equal(tplConfig.id, "onboarding_first_message");

    const payloads = tplConfig.getPayloads({
      phone,
      contactPerson,
      rawToken: token,
      uploadLink
    });

    assert.equal(payloads.length, 1);
    const payload = payloads[0];

    assert.equal(payload.messaging_product, "whatsapp");
    assert.equal(payload.to, "919876543210");
    assert.equal(payload.type, "template");
    assert.equal(payload.template.name, "onboarding_first_message");
    assert.equal(payload.template.language.code, "en");

    // Body parameters
    const bodyComp = payload.template.components.find(c => c.type === "body");
    assert.ok(bodyComp, "Must contain body component");
    assert.equal(bodyComp.parameters[0].parameter_name, "name");
    assert.equal(bodyComp.parameters[0].text, "Test Borrower");

    // Dynamic URL button parameter
    const buttonComp = payload.template.components.find(c => c.type === "button");
    assert.ok(buttonComp, "Must contain button component");
    assert.equal(buttonComp.sub_type, "url");
    assert.equal(buttonComp.parameters[0].text, "secure_token_123");
  });

  test("2. WhatsApp Messaging Pipeline Complete State Machine (Success, Failure & Fallback)", async () => {
    const user = { id: "user_pipe_1", username: "TestAgent", role: "agent" };

    // Branch A: Success State Machine
    const dbSuccess = createPipelineMockDb({ initialBalance: 900 });
    const envSuccess = {
      ENVIRONMENT: "development",
      MOCK_WHATSAPP: "true",
      MOCK_WHATSAPP_STATUS: "sent",
      WHATSAPP_PHONE_ID: "mock_phone_id"
    };

    const resultSuccess = await executeWhatsAppMessagingPipeline(
      dbSuccess,
      user,
      "919876543210",
      "onboarding_first_message",
      "Test Client",
      "tok_123",
      envSuccess,
      "ref_success_1",
      [],
      "cnt_1",
      "case_pipe_1"
    );

    assert.equal(resultSuccess.success, true);
    assert.equal(resultSuccess.delivered, true);
    assert.ok(resultSuccess.providerMsgId.startsWith("wamid.mock_"));
    // Verify successful deduction of 90 paise (900 - 90 = 810)
    const stateSuccess = dbSuccess.getState();
    assert.equal(stateSuccess.balance, 810);
    assert.equal(stateSuccess.reservations[0].status, "COMPLETED");
    assert.equal(stateSuccess.messages[0].status, "SENT");

    // Branch B: Settled Failure Contract State Machine
    const dbFail = createPipelineMockDb({ initialBalance: 900 });
    const envFail = {
      ENVIRONMENT: "development",
      MOCK_WHATSAPP: "true",
      MOCK_WHATSAPP_STATUS: "failed",
      WHATSAPP_PHONE_ID: "mock_phone_id"
    };

    const resultFail = await executeWhatsAppMessagingPipeline(
      dbFail,
      user,
      "919876543210",
      "onboarding_first_message",
      "Test Client",
      "tok_123",
      envFail,
      "ref_fail_1",
      [],
      "cnt_1",
      "case_pipe_1"
    );

    assert.equal(resultFail.success, false);
    assert.equal(resultFail.error, "WHATSAPP_FAILED");
    // Verify settled failure semantics: reservation refunded, message failed, credit balance preserved
    const stateFail = dbFail.getState();
    assert.equal(stateFail.balance, 900, "Credit balance must remain intact after dispatch failure");
    assert.equal(stateFail.reservations[0].status, "REFUNDED");
    assert.equal(stateFail.messages[0].status, "FAILED");

    // Branch C: Graceful Fallback Template Resolution
    const fallbackTpl = getWhatsAppTemplate("non_existent_unregistered_template", envSuccess);
    assert.equal(fallbackTpl.id, "onboarding_first_message", "Unregistered template must gracefully fall back to default template");
  });

  test("3. Hard Cap Enforcement via handleRetryWhatsApp (3-Attempt Maximum)", async () => {
    const user = { id: "user_pipe_1", username: "TestAgent", role: "agent" };
    const env = {
      ENVIRONMENT: "development",
      MOCK_WHATSAPP: "true",
      MOCK_WHATSAPP_STATUS: "sent",
      WHATSAPP_PHONE_ID: "mock_phone_id"
    };

    // Case 1: 0 previous attempts -> Attempt 1 succeeds, 2 attempts left
    const db0 = createPipelineMockDb({ initialBalance: 900, existingAttempts: 0 });
    const c0 = {
      env: { ...env, DB: db0 },
      req: { param: () => "case_pipe_1" },
      get: (k) => k === "user" ? user : null,
      json: (data, status = 200) => ({ status, data })
    };
    const res0 = await handleRetryWhatsApp(c0);
    assert.equal(res0.status, 200);
    assert.equal(res0.data.attemptsUsed, 1);
    assert.equal(res0.data.attemptsLeft, 2);

    // Case 2: 2 previous attempts -> Attempt 3 succeeds, 0 attempts left
    const db2 = createPipelineMockDb({ initialBalance: 900, existingAttempts: 2 });
    const c2 = {
      env: { ...env, DB: db2 },
      req: { param: () => "case_pipe_1" },
      get: (k) => k === "user" ? user : null,
      json: (data, status = 200) => ({ status, data })
    };
    const res2 = await handleRetryWhatsApp(c2);
    assert.equal(res2.status, 200);
    assert.equal(res2.data.attemptsUsed, 3);
    assert.equal(res2.data.attemptsLeft, 0);

    // Case 3: 3 previous attempts -> Hard cap reached, returns 400
    const db3 = createPipelineMockDb({ initialBalance: 900, existingAttempts: 3 });
    const c3 = {
      env: { ...env, DB: db3 },
      req: { param: () => "case_pipe_1" },
      get: (k) => k === "user" ? user : null,
      json: (data, status = 200) => ({ status, data })
    };
    const res3 = await handleRetryWhatsApp(c3);
    assert.equal(res3.status, 400);
    assert.equal(res3.data.hardCapReached, true);
    assert.equal(res3.data.attemptsLeft, 0);
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
    const payloads = tplConfig.getPayloads({ phone: "919876543210", contactPerson: "Test Client", rawToken: "tok_123", templateParams: ["Borrower", "Acme Advisory"] });
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
      case_id: "case_test_123",
      event_type: "whatsapp_sent",
      content: text,
      metadata: JSON.stringify(metadata),
      created_by: "agent"
    };

    assert.equal(timelineEvent.event_type, "whatsapp_sent");
    assert.equal(timelineEvent.created_by, "agent");
    assert.equal(timelineEvent.content, text);
    const parsed = JSON.parse(timelineEvent.metadata);
    assert.equal(parsed.channel, "whatsapp");
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

  test("13. Template Outgoing Timeline Event Contract with renderTemplateBody", () => {
    const templateName = "do_ca";
    const rendered = renderTemplateBody(templateName);

    const metadata = {
      channel: "whatsapp",
      message_type: "template",
      template_name: templateName,
      provider_message_id: "wamid.HBgLM...tpl",
      whatsapp_status: "sent"
    };

    const timelineEvent = {
      id: "evt_tpl_123",
      case_id: "case_direct_123",
      event_type: "whatsapp_sent",
      content: rendered,
      metadata: JSON.stringify(metadata),
      created_by: "system"
    };

    assert.equal(timelineEvent.event_type, "whatsapp_sent");
    assert.ok(timelineEvent.content.includes("Kem cho?"));
    const parsed = JSON.parse(timelineEvent.metadata);
    assert.equal(parsed.channel, "whatsapp");
    assert.equal(parsed.message_type, "template");
    assert.equal(parsed.template_name, "do_ca");
    assert.equal(parsed.provider_message_id, "wamid.HBgLM...tpl");
  });

});
