import { getDbClient } from "../db/client.js";

// Utility to send WhatsApp message via Meta Cloud API
async function sendWhatsAppMessage(phone, text, env) {
  const url = `https://graph.facebook.com/v17.0/${env.WHATSAPP_PHONE_ID}/messages`;
  await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: phone,
      text: { body: text },
    }),
  });
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

  try {
    console.log("INCOMING WEBHOOK:", JSON.stringify(body, null, 2));
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      // Just acknowledge incoming messages for now
      // Document request generation has been moved to the web dashboard (/api/leads)
    }
    return c.text("EVENT_RECEIVED");
  } catch (err) {
    console.error("Webhook processing error:", err);
    return c.text("ERROR", 500);
  }
}
