import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";

async function sendWhatsAppMessage(phone, text, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    const details = data.error?.error_data?.details || "";
    throw new Error(`${data.error?.message || "Failed to send WhatsApp message"}${details ? " | Details: " + details : ""}`);
  }
}

export async function handleWebhookVerify(c) {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode === "subscribe" && token === c.env.WHATSAPP_VERIFY_TOKEN) {
    return c.text(challenge);
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
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    // Handle Status Updates (sent, delivered, read, failed)
    if (statuses && statuses.length > 0) {
      const statusObj = statuses[0];
      const recipientId = statusObj.recipient_id;
      const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
      const errors = statusObj.errors;
      const providerMsgId = statusObj.id;

      let errorMsg = null;
      if (errors && errors.length > 0) {
        errorMsg = errors.map(e => `${e.title || e.message} (${e.code})`).join("; ");
      }

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

    if (messages && messages.length > 0) {
      const message = messages[0];
      const fromPhone = message.from;
      const rawDigits = String(fromPhone).replace(/\D/g, "");
      const shortPhone = rawDigits.startsWith("91") ? rawDigits.slice(2) : rawDigits;
      const fullPhone = "91" + shortPhone;
      const clientText = message.text?.body || message.caption || (message.type ? `[${message.type} received]` : 'Client reply received');
      
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
            await sendWhatsAppMessage(fromPhone, `Here is your secure document upload link: ${uploadLink}`, env).catch(() => {});
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
