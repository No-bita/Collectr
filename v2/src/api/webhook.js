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
  const env = c.env;
  const db = getDbClient(env);

  try {
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    // Handle Status Updates
    if (statuses && statuses.length > 0) {
      const statusObj = statuses[0];
      const recipientId = statusObj.recipient_id;
      const status = statusObj.status;
      
      await db.execute({
        sql: "UPDATE loan_cases SET whatsapp_delivery_status = ? WHERE phone_number = ? OR phone_number = ?",
        args: [status, recipientId, "91" + recipientId]
      });
    }

    if (messages && messages.length > 0) {
      const message = messages[0];
      const fromPhone = message.from;
      
      // Look up loan case by phone number
      const caseRes = await db.execute({
        sql: "SELECT id, contact_person FROM loan_cases WHERE phone_number = ? ORDER BY created_at DESC LIMIT 1",
        args: [fromPhone]
      });

      if (caseRes.rows.length > 0) {
        const loanCase = caseRes.rows[0];
        
        // Fetch active token
        const tokenRes = await db.execute({
          sql: "SELECT token FROM secure_tokens WHERE case_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
          args: [loanCase.id]
        });

        const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;
        
        let msg = `Hello ${loanCase.contact_person || "there"}! We noticed you messaged us. `;
        if (token) {
          const uploadLink = `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=${token}`;
          msg += `You have an active document upload request open for your loan application. Please upload your documents securely here: ${uploadLink}`;
        } else {
          msg += `You have a loan case registered with us, but there are no active document upload links at the moment. Please contact your loan agent if you need to submit new files!`;
        }
        
        await sendWhatsAppMessage(fromPhone, msg, env);

        // Log timeline event
        await db.execute({
          sql: `INSERT INTO case_timeline (id, case_id, event_type, content, created_by)
                VALUES (?, ?, 'whatsapp_sent', 'Automated response sent to client message', 'system')`,
          args: [crypto.randomUUID(), loanCase.id]
        });

      } else {
        const msg = `Hello! Thank you for reaching out to Collectrr Loan Portal. It looks like you don't have an active loan case set up yet. Please contact your loan agent to get invited to submit your documents securely.`;
        await sendWhatsAppMessage(fromPhone, msg, env);
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
