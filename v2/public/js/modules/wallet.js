import { el } from "../core/dom.js";
import { authFetch } from "../core/api.js";
import { state, setCurrentCreditState } from "../core/state.js";

/**
 * Freemium Messaging Credits & Wallet Module.
 */
export async function fetchUserCredits() {
  try {
    const res = await authFetch("/api/user/credits");
    if (!res.ok) return;
    const data = await res.json();
    setCurrentCreditState(data);

    const isDevHost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    const badgeText = el("creditBadgeText");
    const badgeBtn = el("userCreditBadge");

    if (badgeBtn && !isDevHost) {
      badgeBtn.style.display = "none";
    } else if (badgeText && badgeBtn && isDevHost) {
      badgeBtn.style.display = "flex";
      const msgs = data.messagesRemaining || 0;
      if (data.status === "exhausted") {
        badgeText.textContent = `${data.formatted} · Out of Credits`;
        badgeBtn.style.background = "#FEE2E2";
        badgeBtn.style.borderColor = "#FCA5A5";
        badgeBtn.style.color = "#991B1B";
      } else if (data.status === "almost_out") {
        badgeText.textContent = `${data.formatted} · 1 msg left`;
        badgeBtn.style.background = "#FEF3C7";
        badgeBtn.style.borderColor = "#FDE68A";
        badgeBtn.style.color = "#92400E";
      } else if (data.status === "low") {
        badgeText.textContent = `${data.formatted} · ${msgs} msgs left`;
        badgeBtn.style.background = "#FEF3C7";
        badgeBtn.style.borderColor = "#FDE68A";
        badgeBtn.style.color = "#92400E";
      } else {
        badgeText.textContent = `${data.formatted}`;
        badgeBtn.style.background = "#F1F5F9";
        badgeBtn.style.borderColor = "#E2E8F0";
        badgeBtn.style.color = "#1E293B";
      }
    }
    return data;
  } catch (err) {
    console.error("Failed fetching user credits:", err);
  }
}

export async function openRechargeModal() {
  const backdrop = el("rechargeModalBackdrop");
  if (!backdrop) return;

  backdrop.hidden = false;
  const creditData = await fetchUserCredits();

  const balanceDisplay = el("walletBalanceDisplay");
  const msgsBadge = el("walletMessagesBadge");
  const modalTitle = el("rechargeModalTitle");
  const modalSub = el("rechargeModalSub");
  const txList = el("creditTransactionsList");

  if (creditData) {
    if (balanceDisplay) balanceDisplay.textContent = creditData.formatted;
    if (msgsBadge) {
      msgsBadge.textContent = `≈ ${creditData.messagesRemaining} message${
        creditData.messagesRemaining === 1 ? "" : "s"
      } left`;
    }

    if (modalTitle && modalSub) {
      if (creditData.balancePaise <= 0) {
        modalTitle.textContent = "You're out of messaging credits";
        modalSub.textContent =
          "Add credits to continue sending WhatsApp document collection requests and reminders.";
      } else {
        modalTitle.textContent = "You're running low on credits";
        modalSub.textContent = `You have ${creditData.formatted} remaining (${
          creditData.messagesRemaining
        } message${creditData.messagesRemaining === 1 ? "" : "s"} left). Add credits to continue.`;
      }
    }

    if (txList) {
      if (!creditData.transactions || creditData.transactions.length === 0) {
        txList.innerHTML = `<div style="font-size: 12px; color: #94A3B8; text-align: center; padding: 10px;">No previous transaction activity.</div>`;
      } else {
        txList.innerHTML = creditData.transactions
          .map((tx) => {
            const isPositive = Number(tx.amountRupees) > 0;
            const color = isPositive ? "#16A34A" : "#DC2626";
            const sign = isPositive ? "+" : "";
            const dateStr = new Date(tx.createdAt).toLocaleDateString("en-IN", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #F1F5F9; font-size: 12px;">
              <div>
                <div style="font-weight: 600; color: #334155;">${
                  tx.description || tx.transactionType
                }</div>
                <div style="font-size: 10px; color: #94A3B8;">${dateStr}</div>
              </div>
              <div style="font-weight: 700; color: ${color};">
                ${sign}₹${Math.abs(Number(tx.amountRupees)).toFixed(2)}
              </div>
            </div>`;
          })
          .join("");
      }
    }
  }
}

export function closeRechargeModal() {
  const backdrop = el("rechargeModalBackdrop");
  if (backdrop) backdrop.hidden = true;
}

export async function executeSelectedRecharge() {
  const selected = document.querySelector('input[name="rechargeTier"]:checked');
  if (!selected) return;

  const amt = selected.value;
  const btn = el("btnExecuteRecharge");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    const res = await authFetch("/api/user/recharge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountRupees: Number(amt) }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to process recharge");

    if (typeof UI !== "undefined" && UI.toast) {
      UI.toast(data.message || `Wallet recharged successfully with ₹${amt}!`, "success");
    }

    await fetchUserCredits();
    closeRechargeModal();
  } catch (err) {
    alert(err.message || "Recharge failed.");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = `⚡ Recharge ₹${amt}`;
    }
  }
}
