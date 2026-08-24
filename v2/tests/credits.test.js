import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Freemium Messaging Credits & Financial Engine Tests', async (t) => {
  await t.test('Paise Math & Message Conversion Logic', () => {
    const MESSAGE_COST_PAISE = 90;
    
    // ₹9.00 signup bonus = 900 paise
    const initialPaise = 900;
    assert.strictEqual(initialPaise / 100, 9.00);
    assert.strictEqual(Math.floor(initialPaise / MESSAGE_COST_PAISE), 10);

    // After 1 message deduction (90 paise)
    const afterOneMsg = initialPaise - MESSAGE_COST_PAISE;
    assert.strictEqual(afterOneMsg, 810);
    assert.strictEqual((afterOneMsg / 100).toFixed(2), "8.10");
    assert.strictEqual(Math.floor(afterOneMsg / MESSAGE_COST_PAISE), 9);

    // Exact depletion after 10 messages
    const afterTenMsgs = initialPaise - (10 * MESSAGE_COST_PAISE);
    assert.strictEqual(afterTenMsgs, 0);
    assert.strictEqual(Math.floor(afterTenMsgs / MESSAGE_COST_PAISE), 0);
  });

  await t.test('Status Threshold Rules', () => {
    const MESSAGE_COST = 90;
    
    function getStatus(balancePaise) {
      if (balancePaise < MESSAGE_COST) return 'exhausted';
      if (balancePaise < MESSAGE_COST * 2) return 'almost_out';
      if (balancePaise <= MESSAGE_COST * 5) return 'low';
      return 'normal';
    }

    assert.strictEqual(getStatus(900), 'normal');
    assert.strictEqual(getStatus(450), 'low'); // 5 msgs left
    assert.strictEqual(getStatus(180), 'low'); // 2 msgs left
    assert.strictEqual(getStatus(90), 'almost_out'); // 1 msg left
    assert.strictEqual(getStatus(0), 'exhausted'); // 0 msgs left
  });

  await t.test('DOM Elements Integrity for Recharge Wallet & Badge', () => {
    const htmlPath = path.join(process.cwd(), 'public', 'dashboard.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    assert.ok(html.includes('id="userCreditBadge"'), 'dashboard.html must contain #userCreditBadge button');
    assert.ok(html.includes('id="creditBadgeText"'), 'dashboard.html must contain #creditBadgeText container');
    assert.ok(html.includes('id="rechargeModalBackdrop"'), 'dashboard.html must contain #rechargeModalBackdrop modal');
    assert.ok(html.includes('id="rechargeModalTitle"'), 'dashboard.html must contain #rechargeModalTitle header');
    assert.ok(html.includes('id="walletBalanceDisplay"'), 'dashboard.html must contain #walletBalanceDisplay');
    assert.ok(html.includes('id="walletMessagesBadge"'), 'dashboard.html must contain #walletMessagesBadge');
    assert.ok(html.includes('id="creditTransactionsList"'), 'dashboard.html must contain #creditTransactionsList');
    assert.ok(html.includes('id="btnExecuteRecharge"'), 'dashboard.html must contain #btnExecuteRecharge button');
  });

  await t.test('Migration SQL File 0004 Verification', () => {
    const migPath = path.join(process.cwd(), 'migrations', '0004_freemium_messaging_credits.sql');
    assert.ok(fs.existsSync(migPath), '0004_freemium_messaging_credits.sql migration file must exist');

    const sql = fs.readFileSync(migPath, 'utf8');
    assert.ok(sql.includes('credit_balance INTEGER DEFAULT 900'), 'Must define credit_balance INTEGER default 900');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS credit_transactions'), 'Must define credit_transactions table');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS credit_reservations'), 'Must define credit_reservations table');
    assert.ok(sql.includes('CREATE TABLE IF NOT EXISTS whatsapp_messages'), 'Must define whatsapp_messages table');
    assert.ok(sql.includes('UNIQUE(user_id, reference_id, transaction_type)'), 'Must enforce unique transaction constraint');
    assert.ok(sql.includes('UNIQUE(user_id, idempotency_key)'), 'Must enforce unique idempotency constraint');
  });
});
