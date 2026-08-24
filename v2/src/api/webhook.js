import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { sendWhatsAppText } from "../whatsapp/client.js";
import { verifyWebhookSubscription, parseWebhookPayload } from "../whatsapp/webhook.js";

export async function handleWebhookVerify(c) {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  const verification = verifyWebhookSubscription(mode, token, challenge, c.env.WHATSAPP_VERIFY_TOKEN);
  if (verification.verified) {
    return c.text(verification.challenge);
  }
  return c.text("Forbidden", 403);
}

export async function handleWebhookEvent(c) {
  const body = await c.req.json();

  console.log("WHATSAPP WEBHOOK RECEIVED");
  console.log(JSON.stringify(body));

  const env = c.env;
  const db = getDbClient(env);

  try {
    const { statuses, messages } = parseWebhookPayload(body);

    // Handle Status Updates (sent, delivered, read, failed)
    for (const statusObj of statuses) {
      const recipientId = statusObj.recipientId;
      const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
      const providerMsgId = statusObj.providerMsgId;
      const errorMsg = statusObj.errorMsg;

      await db.execute({
        sql: "UPDATE loan_cases SET whatsapp_delivery_status = ? WHERE phone_number = ? OR phone_number = ? OR phone_number = ?",
        args: [status, recipientId, "91" + recipientId, recipientId.replace(/^91/, '')]
      });

      // Update whatsapp_messages table
      if (providerMsgId) {
        await db.execute({
          sql: "UPDATE whatsapp_messages SET status = ? WHERE provider_message_id = ?",
          args: [status.toUpperCase(), providerMsgId]
        }).catch(() => {});
      }

      // Log status in case_timeline if delivered, read, or failed with error
      const caseRes = await db.execute({
        sql: "SELECT id FROM loan_cases WHERE phone_number = ? OR phone_number = ? OR phone_number = ? ORDER BY created_at DESC LIMIT 1",
        args: [recipientId, "91" + recipientId, recipientId.replace(/^91/, '')]
      });

      if (caseRes.rows.length > 0) {
        const caseId = caseRes.rows[0].id;
        if (status === 'delivered') {
          await db.execute({
            sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, 'whatsapp_delivered', 'WhatsApp message delivered to handset (Double Tick)', ?, 'system')`,
            args: [crypto.randomUUID(), caseId, JSON.stringify({ whatsapp_status: 'delivered', provider_message_id: providerMsgId })]
          }).catch(() => {});
        } else if (status === 'read') {
          await db.execute({
            sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, 'whatsapp_read', 'WhatsApp message read by recipient (Blue Tick)', ?, 'system')`,
            args: [crypto.randomUUID(), caseId, JSON.stringify({ whatsapp_status: 'read', provider_message_id: providerMsgId })]
          }).catch(() => {});
        } else if (status === 'failed') {
          await db.execute({
            sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, 'whatsapp_failed', ?, ?, 'system')`,
            args: [
              crypto.randomUUID(),
              caseId,
              `WhatsApp delivery failed: ${errorMsg || 'Recipient unreachable or policy restriction'}`,
              JSON.stringify({ whatsapp_status: 'failed', error: errorMsg, provider_message_id: providerMsgId })
            ]
          }).catch(() => {});
        }
      }
    }

    // Handle Inbound Customer Messages
    for (const msg of messages) {
      const fromPhone = msg.fromPhone;
      const fullPhone = msg.fullPhone;
      const shortPhone = msg.shortPhone;
      const clientText = msg.text;

      // Look up loan case by phone number
      const caseRes = await db.execute({
        sql: "SELECT id, contact_person FROM loan_cases WHERE phone_number = ? OR phone_number = ? OR phone_number = ? ORDER BY created_at DESC LIMIT 1",
        args: [fromPhone, fullPhone, shortPhone]
      });

      if (caseRes.rows.length > 0) {
        const loanCase = caseRes.rows[0];

        // Log incoming client reply event
        await db.execute({
          sql: `INSERT INTO case_timeline (id, case_id, event_type, content, metadata, created_by)
                VALUES (?, ?, 'whatsapp_reply', ?, ?, 'client')`,
          args: [crypto.randomUUID(), loanCase.id, clientText, JSON.stringify({ whatsapp_status: 'replied', phone: fromPhone })]
        });

        // Update case status to replied
        await db.execute({
          sql: "UPDATE loan_cases SET whatsapp_delivery_status = 'replied' WHERE id = ?",
          args: [loanCase.id]
        });

        // Optional automated helper response if client asks for upload link
        if (clientText.toLowerCase().includes("link") || clientText.toLowerCase().includes("upload")) {
          const tokenRes = await db.execute({
            sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
            args: [loanCase.id]
          });
          const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;
          if (token) {
            const uploadLink = `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=${token}`;
            await sendWhatsAppText(fromPhone, `Here is your secure document upload link: ${uploadLink}`, env).catch(() => {});
          }
        }
      }
    }

    return c.text("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook processing error:", err);
    try {
      await logSystemFailure(db, "webhook_error", null, err.message || err);
    } catch(e) {}
    return c.text("ERROR", 500);
  }
}
