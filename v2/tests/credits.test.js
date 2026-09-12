import "./helpers/network-guard.js";
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { handleGetCredits } from '../src/api/credits.js';

function mockContext(balancePaise, transactions = []) {
  return {
    env: {
      DB: {
        prepare: (sql) => ({
          bind: (...args) => ({
            all: async () => {
              if (sql.includes("FROM users")) {
                return { results: [{ credit_balance: balancePaise }] };
              }
              if (sql.includes("FROM credit_transactions")) {
                return { results: transactions };
              }
              return { results: [] };
            }
          })
        })
      }
    },
    get: (key) => key === "user" ? { id: "user_test_123" } : null,
    json: (data, status = 200) => ({ status, data })
  };
}

test('Freemium Messaging Credits & Financial Engine Tests', async (t) => {
  await t.test('1. Production Credit Balance & Message Calculation via handleGetCredits', async () => {
    // ₹9.00 signup bonus = 900 paise -> 10 messages
    const res900 = await handleGetCredits(mockContext(900));
    assert.equal(res900.status, 200);
    assert.equal(res900.data.balancePaise, 900);
    assert.equal(res900.data.balanceRupees, "9.00");
    assert.equal(res900.data.formatted, "₹9.00");
    assert.equal(res900.data.messagesRemaining, 10);

    // After 1 message deducted (810 paise remaining) -> 9 messages
    const res810 = await handleGetCredits(mockContext(810));
    assert.equal(res810.status, 200);
    assert.equal(res810.data.balancePaise, 810);
    assert.equal(res810.data.balanceRupees, "8.10");
    assert.equal(res810.data.formatted, "₹8.10");
    assert.equal(res810.data.messagesRemaining, 9);

    // Exactly 0 paise remaining -> 0 messages
    const res0 = await handleGetCredits(mockContext(0));
    assert.equal(res0.status, 200);
    assert.equal(res0.data.balancePaise, 0);
    assert.equal(res0.data.balanceRupees, "0.00");
    assert.equal(res0.data.formatted, "₹0.00");
    assert.equal(res0.data.messagesRemaining, 0);
  });

  await t.test('2. Production Status Threshold Rules via handleGetCredits', async () => {
    // > 450 paise -> normal
    const resNormal = await handleGetCredits(mockContext(900));
    assert.equal(resNormal.data.status, 'normal');

    // <= 450 paise -> low (5 messages)
    const resLow5 = await handleGetCredits(mockContext(450));
    assert.equal(resLow5.data.status, 'low');
    assert.equal(resLow5.data.messagesRemaining, 5);

    // <= 450 paise -> low (2 messages / 180 paise)
    const resLow2 = await handleGetCredits(mockContext(180));
    assert.equal(resLow2.data.status, 'low');
    assert.equal(resLow2.data.messagesRemaining, 2);

    // < 180 paise -> almost_out (1 message / 90 paise)
    const resAlmostOut = await handleGetCredits(mockContext(90));
    assert.equal(resAlmostOut.data.status, 'almost_out');
    assert.equal(resAlmostOut.data.messagesRemaining, 1);

    // < 90 paise -> exhausted (0 messages / 0 paise)
    const resExhausted = await handleGetCredits(mockContext(0));
    assert.equal(resExhausted.data.status, 'exhausted');
    assert.equal(resExhausted.data.messagesRemaining, 0);
  });

  await t.test('3. DOM Elements Integrity for Recharge Wallet & Badge', () => {
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
});
