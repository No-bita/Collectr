import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";

// Utility to send WhatsApp message via Meta Cloud API
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
    console.error("Webhook WhatsApp Send Error:", JSON.stringify(data));
    const details = data.error?.error_data?.details || "";
    throw new Error(`${data.error?.message || "Failed to send WhatsApp message from webhook"}${details ? " | Details: " + details : ""}`);
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
    console.log("INCOMING WEBHOOK:", JSON.stringify(body, null, 2));
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;
    const statuses = value?.statuses;

    // Handle Status Updates (e.g., delivered, read, failed)
    if (statuses && statuses.length > 0) {
      const statusObj = statuses[0];
      const recipientId = statusObj.recipient_id; // Phone number
      const status = statusObj.status; // 'sent', 'delivered', 'read', or 'failed'
      
      console.log(`WHATSAPP STATUS UPDATE: Number=${recipientId}, Status=${status}`);
      
      await db.execute({
        sql: "UPDATE leads SET whatsapp_delivery_status = ? WHERE phone_number = ? OR phone_number = ?",
        args: [status, recipientId, "91" + recipientId]
      });
    }

    if (messages && messages.length > 0) {
      const message = messages[0];
      const fromPhone = message.from; // Sender's phone number (with country code, e.g. 91xxxxxxxxxx)
      
      // Look up lead by phone number
      const leadRes = await db.execute({
        sql: "SELECT id, name FROM leads WHERE phone_number = ?",
        args: [fromPhone]
      });

      if (leadRes.rows.length > 0) {
        const lead = leadRes.rows[0];
        
        // Fetch active token
        const tokenRes = await db.execute({
          sql: "SELECT token FROM secure_tokens WHERE lead_id = ? AND expires_at > datetime('now') ORDER BY expires_at DESC LIMIT 1",
          args: [lead.id]
        });

        const token = tokenRes.rows.length > 0 ? tokenRes.rows[0].token : null;
        
        let msg = `Hello ${lead.name || "there"}! We noticed you messaged us. `;
        if (token) {
          const uploadLink = `${env.FRONTEND_URL || "https://lekho-edge.shahaaryan-milan-mst20.workers.dev"}/upload.html?t=${token}`;
          msg += `You have an active document upload request open. Please upload your documents securely here: ${uploadLink}`;
        } else {
          msg += `You are registered with us, but there are no active document upload requests at the moment. Please contact your CA directly if you need to submit new files!`;
        }
        
        await sendWhatsAppMessage(fromPhone, msg, env);
      } else {
        // User does not exist
        const msg = `Hello! Thank you for reaching out to Lekho Secure Document portal. It looks like you don't have an active portal link set up yet. Please contact your Chartered Accountant (CA) to get invited to submit your documents securely.`;
        await sendWhatsAppMessage(fromPhone, msg, env);
      }
    }
    return c.text("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook processing error:", err);
    try {
      // Try to log system failure
      await logSystemFailure(db, "webhook_error", null, err.message || err);
    } catch(e) {}
    return c.text("ERROR", 500);
  }
}
