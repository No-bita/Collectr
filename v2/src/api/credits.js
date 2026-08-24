import { getDbClient } from "../db/client.js";

// MESSAGE COST DEFINITION: 90 paise = ₹0.90 per outbound WhatsApp message
export const MESSAGE_COST_PAISE = 90;

export async function handleGetCredits(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  try {
    const userRes = await db.execute({
      sql: "SELECT credit_balance FROM users WHERE id = ?",
      args: [user.id]
    });

    const rawBalance = userRes.rows[0]?.credit_balance;
    const balancePaise = (rawBalance !== undefined && rawBalance !== null) ? Number(rawBalance) : 900;
    const balanceRupees = (balancePaise / 100).toFixed(2);
    const messagesRemaining = Math.max(0, Math.floor(balancePaise / MESSAGE_COST_PAISE));

    let status = 'normal';
    if (balancePaise < MESSAGE_COST_PAISE) {
      status = 'exhausted';
    } else if (balancePaise < MESSAGE_COST_PAISE * 2) {
      status = 'almost_out';
    } else if (balancePaise <= MESSAGE_COST_PAISE * 5) {
      status = 'low';
    }

    const txRes = await db.execute({
      sql: "SELECT id, amount_paise, balance_after_paise, transaction_type, reference_type, reference_id, description, created_at FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20",
      args: [user.id]
    });

    const transactions = txRes.rows.map(row => ({
      id: row.id,
      amountPaise: row.amount_paise,
      amountRupees: (row.amount_paise / 100).toFixed(2),
      balanceAfterRupees: (row.balance_after_paise / 100).toFixed(2),
      transactionType: row.transaction_type,
      description: row.description,
      createdAt: row.created_at
    }));

    return c.json({
      success: true,
      balancePaise,
      balanceRupees,
      formatted: `₹${balanceRupees}`,
      messagesRemaining,
      status,
      transactions
    });
  } catch (err) {
    console.error("Get credits error:", err);
    return c.json({ error: "Failed to fetch credit details" }, 500);
  }
}

export async function handleRechargeCredits(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  if (!user || !user.id) return c.json({ error: "Unauthorized" }, 401);

  const { amountRupees } = await c.req.json().catch(() => ({}));
  const amt = Number(amountRupees);
  
  if (!amt || isNaN(amt) || amt <= 0) {
    return c.json({ error: "Please select a valid recharge amount (₹50, ₹100, ₹250, ₹500)." }, 400);
  }

  const amountPaise = Math.round(amt * 100);
  const orderRef = "ord_rzp_" + crypto.randomUUID().slice(0, 8);

  try {
    const currentRes = await db.execute({
      sql: "SELECT credit_balance FROM users WHERE id = ?",
      args: [user.id]
    });
    const currentPaise = currentRes.rows[0]?.credit_balance ?? 0;
    const newBalancePaise = currentPaise + amountPaise;

    await db.execute({
      sql: "UPDATE users SET credit_balance = ? WHERE id = ?",
      args: [newBalancePaise, user.id]
    });

    const txId = "tx_rec_" + crypto.randomUUID();
    await db.execute({
      sql: "INSERT INTO credit_transactions (id, user_id, amount_paise, balance_after_paise, transaction_type, reference_type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [txId, user.id, amountPaise, newBalancePaise, 'recharge', 'razorpay_order', orderRef, `Wallet Recharge (+₹${amt.toFixed(2)})`]
    });

    const messagesRemaining = Math.floor(newBalancePaise / MESSAGE_COST_PAISE);

    return c.json({
      success: true,
      message: `Successfully recharged ₹${amt.toFixed(2)}!`,
      newBalancePaise,
      newBalanceRupees: (newBalancePaise / 100).toFixed(2),
      formatted: `₹${(newBalancePaise / 100).toFixed(2)}`,
      messagesRemaining
    });
  } catch (err) {
    console.error("Recharge credits error:", err);
    return c.json({ error: "Failed to process credit recharge" }, 500);
  }
}

export async function handleAdminAdjustCredits(c) {
  const db = getDbClient(c.env);
  const user = c.get("user");
  if (!user || user.role !== 'admin') {
    return c.json({ error: "Forbidden: Admin privileges required" }, 403);
  }

  const { targetUserId, amountRupees, reason } = await c.req.json().catch(() => ({}));
  const amt = Number(amountRupees);
  if (!targetUserId || isNaN(amt) || amt === 0) {
    return c.json({ error: "Target User ID, non-zero amount, and audit reason are required." }, 400);
  }

  const amountPaise = Math.round(amt * 100);
  const adjRef = "adj_" + crypto.randomUUID().slice(0, 8);

  try {
    const currentRes = await db.execute({
      sql: "SELECT credit_balance FROM users WHERE id = ?",
      args: [targetUserId]
    });
    if (currentRes.rows.length === 0) return c.json({ error: "Target user not found" }, 404);

    const currentPaise = currentRes.rows[0].credit_balance ?? 0;
    const newBalancePaise = Math.max(0, currentPaise + amountPaise);

    await db.execute({
      sql: "UPDATE users SET credit_balance = ? WHERE id = ?",
      args: [newBalancePaise, targetUserId]
    });

    const txId = "tx_adj_" + crypto.randomUUID();
    const auditDesc = `Admin Adjustment by ${user.username}: ${reason || 'Manual correction'} (${amt >= 0 ? '+' : ''}₹${amt.toFixed(2)})`;

    await db.execute({
      sql: "INSERT INTO credit_transactions (id, user_id, amount_paise, balance_after_paise, transaction_type, reference_type, reference_id, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      args: [txId, targetUserId, amountPaise, newBalancePaise, 'admin_adjustment', 'admin_ref', adjRef, auditDesc]
    });

    return c.json({
      success: true,
      message: `Adjusted user balance by ₹${amt.toFixed(2)}. New Balance: ₹${(newBalancePaise / 100).toFixed(2)}`,
      newBalancePaise,
      newBalanceRupees: (newBalancePaise / 100).toFixed(2)
    });
  } catch (err) {
    console.error("Admin adjust credits error:", err);
    return c.json({ error: "Failed to adjust user credits" }, 500);
  }
}
