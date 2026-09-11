import { getDbClient } from "../db/client.js";
import { logSystemFailure } from "./failures.js";
import { sendWhatsAppText, normalizeIndianPhoneNumber } from "../whatsapp/client.js";
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
  const body = await c.req.json().catch(() => ({}));

  console.log("WHATSAPP WEBHOOK RECEIVED:", JSON.stringify(body));

  const env = c.env;
  const db = getDbClient(env);

  try {
    const { statuses, messages } = parseWebhookPayload(body);

    // 1. Handle Status Updates (sent, delivered, read, failed)
    for (const statusObj of statuses) {
      const recipientId = statusObj.recipientId;
      const status = statusObj.status; // 'sent', 'delivered', 'read', 'failed'
      const providerMsgId = statusObj.providerMsgId;
      const errorMsg = statusObj.errorMsg;

      if (!providerMsgId) continue;

      // Authoritative message lookup by provider_message_id
      const msgRes = await db.execute({
        sql: "SELECT id, user_id, idempotency_key, status FROM whatsapp_messages WHERE provider_message_id = ? LIMIT 1",
        args: [providerMsgId]
      });

      const waMsg = msgRes.rows[0] || null;
      const userId = waMsg?.user_id || null;

      // Update whatsapp_messages table
      await db.execute({
        sql: "UPDATE whatsapp_messages SET status = ? WHERE provider_message_id = ?",
        args: [status.toUpperCase(), providerMsgId]
      }).catch(() => {});

      // Credit Reconciliation for UNKNOWN / PENDING state transitions
      const isDevEnv = (env?.ENVIRONMENT === 'development');
      if (isDevEnv && userId && waMsg) {
        const MESSAGE_COST_PAISE = 90;

        if (status === 'delivered' || status === 'read' || status === 'sent') {
          // Finalize reservation to COMPLETED
          await db.execute({
            sql: "UPDATE credit_reservations SET status = 'COMPLETED', completed_at = CURRENT_TIMESTAMP WHERE user_id = ? AND reference_id LIKE ? AND status = 'UNKNOWN'",
            args: [userId, `%${waMsg.idempotency_key}%`]
          }).catch(() => {});
        } else if (status === 'failed') {
          // If reservation was UNKNOWN or PENDING, execute refund
          const resCheck = await db.execute({
            sql: "SELECT id, status FROM credit_reservations WHERE user_id = ? AND reference_id LIKE ? AND status IN ('UNKNOWN', 'PENDING') LIMIT 1",
            args: [userId, `%${waMsg.idempotency_key}%`]
          });

          if (resCheck.rows.length > 0) {
            await db.execute({
              sql: "UPDATE credit_reservations SET status = 'REFUNDED', completed_at = CURRENT_TIMESTAMP WHERE id = ?",
              args: [resCheck.rows[0].id]
            }).catch(() => {});

            // Refund user balance
            await db.execute({
              sql: "UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?",
              args: [MESSAGE_COST_PAISE, userId]
            }).catch(() => {});

            // Log refund ledger entry
            const txId = "tx_ref_" + crypto.randomUUID();
            await db.execute({
              sql: `INSERT OR IGNORE INTO credit_transactions (id, user_id, amount_paise, balance_after_paise, transaction_type, reference_type, reference_id, description)
                    SELECT ?, ?, ?, credit_balance, 'whatsapp_refund', 'whatsapp_message', ?, 'WhatsApp Delivery Failure Refund (+₹0.90)'
                    FROM users WHERE id = ?`,
              args: [txId, userId, MESSAGE_COST_PAISE, providerMsgId, userId]
            }).catch(() => {});
          }
        }
      }

      // Update case_timeline and mini target (loan_cases)
      const timelineRes = await db.execute({
        sql: "SELECT id, contact_id, case_id FROM case_timeline WHERE provider_message_id = ? LIMIT 1",
        args: [providerMsgId]
      });

      if (timelineRes.rows.length > 0) {
        const tRow = timelineRes.rows[0];
        if (tRow.case_id) {
          await db.execute({
            sql: "UPDATE loan_cases SET whatsapp_delivery_status = ?, last_updated = datetime('now') WHERE id = ?",
            args: [status, tRow.case_id]
          }).catch(() => {});
        }

        if (status === 'delivered') {
          await db.execute({
            sql: `INSERT OR IGNORE INTO case_timeline (id, contact_id, case_id, provider_message_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, ?, ?, 'whatsapp_delivered', 'WhatsApp message delivered to handset (Double Tick)', ?, 'system')`,
            args: [crypto.randomUUID(), tRow.contact_id, tRow.case_id, providerMsgId + "_deliv", JSON.stringify({ whatsapp_status: 'delivered', provider_message_id: providerMsgId })]
          }).catch(() => {});
        } else if (status === 'read') {
          await db.execute({
            sql: `INSERT OR IGNORE INTO case_timeline (id, contact_id, case_id, provider_message_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, ?, ?, 'whatsapp_read', 'WhatsApp message read by recipient (Blue Tick)', ?, 'system')`,
            args: [crypto.randomUUID(), tRow.contact_id, tRow.case_id, providerMsgId + "_read", JSON.stringify({ whatsapp_status: 'read', provider_message_id: providerMsgId })]
          }).catch(() => {});
        } else if (status === 'failed') {
          await db.execute({
            sql: `INSERT OR IGNORE INTO case_timeline (id, contact_id, case_id, provider_message_id, event_type, content, metadata, created_by)
                  VALUES (?, ?, ?, ?, 'whatsapp_failed', ?, ?, 'system')`,
            args: [
              crypto.randomUUID(),
              tRow.contact_id,
              tRow.case_id,
              providerMsgId + "_fail",
              `WhatsApp delivery failed: ${errorMsg || 'Recipient unreachable or policy restriction'}`,
              JSON.stringify({ whatsapp_status: 'failed', error: errorMsg, provider_message_id: providerMsgId })
            ]
          }).catch(() => {});
        }
      }
    }

    // 2. Handle Inbound Customer Messages (Strict Inbound Tenant Resolution)
    for (const msg of messages) {
      const phoneNumberId = msg.phoneNumberId;
      const clientText = msg.text;
      const providerMsgId = msg.messageId;

      if (!clientText) continue;

      let canonicalPhone;
      try {
        canonicalPhone = normalizeIndianPhoneNumber(msg.fromPhone || msg.fullPhone);
      } catch (_) {
        console.warn("Invalid inbound phone format, skipping:", msg.fromPhone);
        continue;
      }

      // Resolve Tenant (user_id) strictly via Meta Business Phone ID
      let userId = null;

      if (phoneNumberId) {
        const userRes = await db.execute({
          sql: "SELECT id FROM users WHERE wa_phone_number_id = ? LIMIT 1",
          args: [phoneNumberId]
        });
        if (userRes.rows.length > 0) {
          userId = userRes.rows[0].id;
        }
      }

      // Single-tenant / dev environment fallback if wa_phone_number_id is unset
      if (!userId) {
        if (env?.WHATSAPP_PHONE_ID && phoneNumberId === env.WHATSAPP_PHONE_ID) {
          const firstAdmin = await db.execute("SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1");
          if (firstAdmin.rows.length > 0) {
            userId = firstAdmin.rows[0].id;
          }
        }
      }

      if (!userId) {
        console.warn(`[SECURITY] Inbound webhook received for unmapped WhatsApp Phone Number ID: ${phoneNumberId}. Dropping safely.`);
        continue;
      }

      // Tenant-Scoped Contact Lookup
      const contactRes = await db.execute({
        sql: "SELECT id, contact_person FROM contacts WHERE user_id = ? AND phone_number = ? LIMIT 1",
        args: [userId, canonicalPhone]
      });

      let contactId = null;

      if (contactRes.rows.length > 0) {
        contactId = contactRes.rows[0].id;
      } else {
        // Unrecognized sender -> Auto-create Contact under this tenant (with 0 Mini Targets)
        contactId = "cnt_" + crypto.randomUUID();
        const contactPerson = msg.profileName || `Client ${canonicalPhone.slice(-4)}`;
        await db.execute({
          sql: "INSERT INTO contacts (id, user_id, contact_person, phone_number, created_at, last_updated) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))",
          args: [contactId, userId, contactPerson, canonicalPhone]
        });
      }

      // Insert Inbound Message with case_id = NULL (Idempotent via provider_message_id)
      const timelineEventId = crypto.randomUUID();
      await db.execute({
        sql: `INSERT OR IGNORE INTO case_timeline (id, contact_id, case_id, provider_message_id, event_type, content, metadata, created_by)
              VALUES (?, ?, NULL, ?, 'whatsapp_reply', ?, ?, 'client')`,
        args: [
          timelineEventId,
          contactId,
          providerMsgId,
          clientText,
          JSON.stringify({ whatsapp_status: 'replied', phone: canonicalPhone, channel: 'whatsapp' })
        ]
      });

      // Update Contact last_updated
      await db.execute({
        sql: "UPDATE contacts SET last_updated = datetime('now') WHERE id = ?",
        args: [contactId]
      }).catch(() => {});

      // If client asks for upload link, send active token link if available
      if (clientText.toLowerCase().includes("link") || clientText.toLowerCase().includes("upload")) {
        const tokenRes = await db.execute({
          sql: `SELECT st.token FROM secure_tokens st 
                JOIN loan_cases lc ON lc.id = st.case_id 
                WHERE lc.contact_id = ? AND st.expires_at > datetime('now') 
                ORDER BY st.expires_at DESC LIMIT 1`,
          args: [contactId]
        });
        const token = tokenRes.rows[0]?.token || null;
        if (token) {
          const uploadLink = `${env.FRONTEND_URL || "https://collectrr-v2.collectr.workers.dev"}/upload.html?t=${token}`;
          await sendWhatsAppText(canonicalPhone, `Here is your secure document upload link: ${uploadLink}`, env).catch(() => {});
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
