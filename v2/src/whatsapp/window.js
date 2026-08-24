/**
 * WhatsApp 24-Hour Customer Service Window Logic
 * Collectrr v2 - WhatsApp Messaging Module
 *
 * Enforces Meta's 24-hour policy for free-form business messaging
 * based on the customer's most recent inbound WhatsApp message.
 */

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

/**
 * Pure timestamp calculation to test if a given timestamp is within the 24h window.
 */
export function isWithin24HourServiceWindow(lastReplyTimestamp, now = Date.now()) {
  if (!lastReplyTimestamp) return false;
  const replyTime = typeof lastReplyTimestamp === "number"
    ? lastReplyTimestamp
    : new Date(lastReplyTimestamp).getTime();
  if (isNaN(replyTime)) return false;

  return (now - replyTime) < TWENTY_FOUR_HOURS_MS && (now - replyTime) >= 0;
}

/**
 * Evaluate the customer service window for a case from its timeline history.
 */
export async function getCustomerReplyWindowStatus(db, caseId) {
  const replyRes = await db.execute({
    sql: `SELECT created_at FROM case_timeline 
          WHERE case_id = ? AND event_type = 'whatsapp_reply' AND created_by = 'client'
          ORDER BY created_at DESC LIMIT 1`,
    args: [caseId],
  });

  if (!replyRes || !replyRes.rows || replyRes.rows.length === 0) {
    return {
      hasReplied: false,
      isOpen: false,
      lastReplyAt: null,
      expiresAt: null,
      reason:
        "No customer reply has been received for this case. Free-form messaging requires an inbound customer message.",
    };
  }

  const lastReplyStr = replyRes.rows[0].created_at;
  let lastReplyTime = new Date(
    lastReplyStr.includes("T") ? lastReplyStr : lastReplyStr.replace(" ", "T") + "Z"
  ).getTime();
  if (isNaN(lastReplyTime)) {
    lastReplyTime = new Date(lastReplyStr).getTime();
  }

  const now = Date.now();
  const expiresTime = lastReplyTime + TWENTY_FOUR_HOURS_MS;
  const isOpen = isWithin24HourServiceWindow(lastReplyTime, now);

  return {
    hasReplied: true,
    isOpen,
    lastReplyAt: new Date(lastReplyTime).toISOString(),
    expiresAt: new Date(expiresTime).toISOString(),
    reason: isOpen
      ? "24-hour customer service window is active."
      : "The 24-hour customer service window has expired. Waiting for customer to reply before sending new free-form messages.",
  };
}
