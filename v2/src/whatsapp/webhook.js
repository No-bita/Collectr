/**
 * Meta WhatsApp Webhook Payload Parser & Verifier
 * Collectrr v2 - WhatsApp Messaging Module
 *
 * Dedicated strictly to parsing and normalizing Meta webhook event structures.
 * Contains ZERO database access or application case logic.
 */

/**
 * Verifies webhook subscription challenge from Meta.
 */
export function verifyWebhookSubscription(mode, token, challenge, expectedToken) {
  if (mode === "subscribe" && token === expectedToken) {
    return { verified: true, challenge };
  }
  return { verified: false, challenge: null };
}

/**
 * Normalizes and extracts incoming messages and delivery status updates from raw webhook body.
 */
export function parseWebhookPayload(body) {
  const result = {
    statuses: [],
    messages: [],
  };

  if (!body || typeof body !== "object") {
    return result;
  }

  const entries = Array.isArray(body.entry) ? body.entry : [];

  for (const entry of entries) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];

    for (const change of changes) {
      const value = change.value;
      if (!value) continue;

      // Extract delivery status updates (sent, delivered, read, failed)
      if (Array.isArray(value.statuses)) {
        for (const statusObj of value.statuses) {
          const recipientId = statusObj.recipient_id || "";
          const status = String(statusObj.status || "").toLowerCase(); // 'sent', 'delivered', 'read', 'failed'
          const providerMsgId = statusObj.id || null;
          const errors = Array.isArray(statusObj.errors) ? statusObj.errors : [];

          let errorMsg = null;
          if (errors.length > 0) {
            errorMsg = errors
              .map((e) => `${e.title || e.message || "Error"} (${e.code || "unknown"})`)
              .join("; ");
          }

          result.statuses.push({
            status,
            recipientId,
            providerMsgId,
            errorMsg,
            timestamp: statusObj.timestamp || null,
          });
        }
      }

      // Extract inbound client messages
      if (Array.isArray(value.messages)) {
        for (const message of value.messages) {
          const fromPhone = String(message.from || "");
          const rawDigits = fromPhone.replace(/\D/g, "");
          const shortPhone = rawDigits.startsWith("91") && rawDigits.length === 12
            ? rawDigits.slice(2)
            : rawDigits;
          const fullPhone = "91" + shortPhone;

          const text =
            message.text?.body ||
            message.caption ||
            (message.type ? `[${message.type} received]` : "Client reply received");

          result.messages.push({
            messageId: message.id || null,
            fromPhone,
            shortPhone,
            fullPhone,
            text,
            type: message.type || "text",
            timestamp: message.timestamp || null,
          });
        }
      }
    }
  }

  return result;
}
