let allCases = [];
let documentCatalog = [];
let loanProductsList = [];
let statusFilter = "all";
let expandedCaseId = null;

const el = (id) => document.getElementById(id);

async function authFetch(url, options = {}) {
  let token = localStorage.getItem('collectrr_auth');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (!token && isDev) {
    token = 'Bearer dev_token';
  } else if (!token) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Authentication required");
  }

  const headers = {
    ...options.headers,
    'Authorization': token
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !isDev) {
    localStorage.removeItem('collectrr_auth');
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Session expired. Please log in again.");
  }
  return res;
}

function formatLacs(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return "—";
  return `₹${num} Lacs`;
}

// ----------------------------------------------------
// FREEMIUM CREDITS & RECHARGE WALLET ENGINE
// ----------------------------------------------------
let currentCreditState = null;

async function fetchUserCredits() {
  try {
    const res = await authFetch("/api/user/credits");
    if (!res.ok) return;
    const data = await res.json();
    currentCreditState = data;

    const isDevHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const badgeText = el("creditBadgeText");
    const badgeBtn = el("userCreditBadge");

    if (badgeBtn && !isDevHost) {
      badgeBtn.style.display = "none";
    } else if (badgeText && badgeBtn && isDevHost) {
      badgeBtn.style.display = "flex";
      const msgs = data.messagesRemaining || 0;
      if (data.status === 'exhausted') {
        badgeText.textContent = `${data.formatted} · Out of Credits`;
        badgeBtn.style.background = "#FEE2E2";
        badgeBtn.style.borderColor = "#FCA5A5";
        badgeBtn.style.color = "#991B1B";
      } else if (data.status === 'almost_out') {
        badgeText.textContent = `${data.formatted} · 1 msg left`;
        badgeBtn.style.background = "#FEF3C7";
        badgeBtn.style.borderColor = "#FDE68A";
        badgeBtn.style.color = "#92400E";
      } else if (data.status === 'low') {
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

async function openRechargeModal() {
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
      msgsBadge.textContent = `≈ ${creditData.messagesRemaining} message${creditData.messagesRemaining === 1 ? '' : 's'} left`;
    }

    if (modalTitle && modalSub) {
      if (creditData.balancePaise <= 0) {
        modalTitle.textContent = "You're out of messaging credits";
        modalSub.textContent = "Add credits to continue sending WhatsApp document collection requests and reminders.";
      } else {
        modalTitle.textContent = "You're running low on credits";
        modalSub.textContent = `You have ${creditData.formatted} remaining (${creditData.messagesRemaining} message${creditData.messagesRemaining === 1 ? '' : 's'} left). Add credits to continue.`;
      }
    }

    if (txList) {
      if (!creditData.transactions || creditData.transactions.length === 0) {
        txList.innerHTML = `<div style="font-size: 12px; color: #94A3B8; text-align: center; padding: 10px;">No previous transaction activity.</div>`;
      } else {
        txList.innerHTML = creditData.transactions.map(tx => {
          const isPositive = Number(tx.amountRupees) > 0;
          const color = isPositive ? '#16A34A' : '#DC2626';
          const sign = isPositive ? '+' : '';
          const dateStr = new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

          return `<div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #F1F5F9; font-size: 12px;">
            <div>
              <div style="font-weight: 600; color: #334155;">${tx.description || tx.transactionType}</div>
              <div style="font-size: 10px; color: #94A3B8;">${dateStr}</div>
            </div>
            <div style="font-weight: 700; color: ${color};">
              ${sign}₹${Math.abs(Number(tx.amountRupees)).toFixed(2)}
            </div>
          </div>`;
        }).join('');
      }
    }
  }
}

function closeRechargeModal() {
  const backdrop = el("rechargeModalBackdrop");
  if (backdrop) backdrop.hidden = true;
}

async function executeSelectedRecharge() {
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
      body: JSON.stringify({ amountRupees: Number(amt) })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to process recharge");

    if (typeof UI !== 'undefined' && UI.toast) {
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

function formatStatus(status) {
  const map = {
    lead: "Lead",
    documents_pending: "Docs Pending",
    ready_for_review: "Ready for Review",
    submitted: "Submitted",
    approved: "Approved",
    disbursed: "Disbursed",
    closed: "Closed"
  };
  return map[status] || status;
}

const WHATSAPP_STATUS_ORDER = [
  "queued",
  "dispatch_requested",
  "pending",
  "sent",
  "delivered",
  "read",
  "replied",
  "failed"
];

function formatWhatsAppDeliveryStatus(status) {
  const map = {
    queued: "Queued",
    dispatch_requested: "Dispatch Requested",
    sent: "Sent",
    delivered: "Delivered",
    read: "Read",
    replied: "Replied",
    failed: "Failed",
    pending: "Pending",
    scheduled: "Scheduled",
    unknown: "Unknown",
    none: "—"
  };
  const key = String(status || "").toLowerCase().trim();
  return map[key] || (key ? key.charAt(0).toUpperCase() + key.slice(1) : "—");
}

function getDisplayStatus(c, mode) {
  if (!c) return null;
  if (mode === "direct_outreach") {
    const raw = c.whatsappDeliveryStatus || c.whatsapp_delivery_status;
    if (raw && typeof raw === 'string' && raw.trim()) return raw.trim().toLowerCase();
    return "pending";
  }
  return c.status || null;
}

function getWhatsAppDeliveryBadgeHtml(status) {
  const st = String(status || "").toLowerCase().trim();
  let badgeStyle = "background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0;";
  if (st === 'sent') {
    badgeStyle = "background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0;";
  } else if (st === 'delivered') {
    badgeStyle = "background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0;";
  } else if (st === 'read') {
    badgeStyle = "background: #DBEAFE; color: #1D4ED8; border: 1px solid #BFDBFE;";
  } else if (st === 'replied') {
    badgeStyle = "background: #E0E7FF; color: #3730A3; border: 1px solid #C7D2FE;";
  } else if (st === 'failed') {
    badgeStyle = "background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;";
  } else if (st === 'queued' || st === 'dispatch_requested' || st === 'pending') {
    badgeStyle = "background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A;";
  } else if (st === 'scheduled') {
    badgeStyle = "background: #EDE9FE; color: #6D28D9; border: 1px solid #DDD6FE;";
  } else if (st === 'unknown') {
    badgeStyle = "background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1;";
  }
  const label = formatWhatsAppDeliveryStatus(st);
  return `<span class="badge" style="${badgeStyle} font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 6px;">${escapeHtml(label)}</span>`;
}

function getInitials(name) {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarStyle(name) {
  const colors = [
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#dcfce7', color: '#15803d' },
    { bg: '#feefc3', color: '#b45309' },
    { bg: '#f3e8ff', color: '#7e22ce' },
    { bg: '#e0e7ff', color: '#4338ca' },
    { bg: '#ffe4e6', color: '#be123c' }
  ];
  let hash = 0;
  for (let i = 0; i < (name || "").length; i++) hash += name.charCodeAt(i);
  const style = colors[Math.abs(hash) % colors.length];
  return `background: ${style.bg}; color: ${style.color};`;
}

function formatAmountDisplay(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return "—";
  if (num >= 100) {
    return `₹${(num / 100).toFixed(2)} Cr`;
  }
  return `₹${num.toFixed(2)} Lacs`;
}

function maskPhone(phone) {
  if (!phone) return "—";
  const clean = phone.toString().replace(/\D/g, "");
  if (clean.length === 10) return `${clean.slice(0, 2)}*****${clean.slice(7)}`;
  if (clean.length === 12 && clean.startsWith("91")) return `+91 ${clean.slice(2, 4)}*****${clean.slice(9)}`;
  if (clean.length >= 5) return `${clean.slice(0, 2)}*****${clean.slice(-3)}`;
  return phone;
}

const DOCUMENT_CATALOG_MAP = {
  'pan': 'PAN Card',
  'aadhaar': 'Aadhaar Card',
  'bank_statement': 'Bank Statement',
  'itr': 'ITR Acknowledgment',
  'gst_returns': 'GST Returns',
  'quotation': 'Machinery/Equipment Quotation',
  'property_docs': 'Property Ownership Documents',
  'invoices': 'Pending Invoices'
};

function getDocumentLabel(req) {
  if (!req) return 'Document';
  const typeKey = String(req.type || req.document_type || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[typeKey]) return DOCUMENT_CATALOG_MAP[typeKey];
  const labelKey = String(req.label || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[labelKey]) return DOCUMENT_CATALOG_MAP[labelKey];
  return req.label || req.type || 'Document';
}

function getNextActionDisplay(c) {
  const status = c.status || 'lead';
  const prog = c.docProgress || { fulfilled: 0, total: 0 };
  const reqs = c.docRequirements || [];

  if (status === 'ready_for_review') {
    return {
      main: '✓ Ready for Credit Review',
      sub: 'Ready for credit team review',
      color: '#16a34a'
    };
  }
  if (status === 'submitted') {
    return {
      main: '✈ Sent to Lender',
      sub: 'Submitted to bank / NBFC',
      color: '#9333ea'
    };
  }
  if (status === 'approved') {
    return {
      main: '🎉 Credit Approved',
      sub: 'Sanction letter issued',
      color: '#059669'
    };
  }
  if (status === 'disbursed') {
    return {
      main: '💰 Disbursed',
      sub: 'Funds transferred to client',
      color: '#15803d'
    };
  }

  // Pending status: find first missing document label
  const missingDoc = reqs.find(r => r.status !== 'received' && (!r.uploads || r.uploads.length === 0));
  const docName = missingDoc ? (missingDoc.label || missingDoc.type) : 'Documents';

  if (prog.fulfilled > 0) {
    return {
      main: `⏰ Waiting for ${docName}`,
      sub: `${prog.fulfilled}/${prog.total} docs uploaded`,
      color: '#d97706'
    };
  }

  return {
    main: `📄 Waiting for ${docName}`,
    sub: 'Not reminded yet',
    color: '#d97706'
  };
}

function populateLoanTypeFilter() {
  const filterEl = el("loanTypeFilter");
  if (!filterEl) return;

  const currentVal = filterEl.value || "all";
  const typesSet = new Set();

  (allCases || []).forEach(c => {
    if (c.loanProduct) typesSet.add(c.loanProduct.trim());
  });

  const sortedTypes = Array.from(typesSet).sort();

  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  let defaultOpt = '<option value="all">All Categories</option>';
  if (persona === 'direct_outreach') {
    defaultOpt = '<option value="all">All Templates</option>';
  } else if (persona === 'loan_agent') {
    defaultOpt = '<option value="all">All Collection Types</option>';
  }
  filterEl.innerHTML = defaultOpt;
  sortedTypes.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    filterEl.appendChild(opt);
  });

  filterEl.value = currentVal;
  if (typeof UI !== 'undefined' && UI.replaceSelect) {
    UI.replaceSelect(filterEl);
  }
}

function populateStatusFilter() {
  const filterEl = el("statusFilter");
  if (!filterEl) return;

  const currentVal = filterEl.value || statusFilter || "all";
  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const isDirectOutreach = (persona === 'direct_outreach');
  const statusSet = new Set();

  (allCases || []).forEach(c => {
    if (typeof isCaseForPersona === 'function' && !isCaseForPersona(c, persona)) return;
    const st = getDisplayStatus(c, persona);
    if (st) statusSet.add(st);
  });

  let sortedStatuses = Array.from(statusSet);
  if (isDirectOutreach) {
    sortedStatuses.sort((a, b) => {
      const idxA = WHATSAPP_STATUS_ORDER.indexOf(a);
      const idxB = WHATSAPP_STATUS_ORDER.indexOf(b);
      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;
      return valA - valB || a.localeCompare(b);
    });
  } else {
    const LIFECYCLE_ORDER = ['lead', 'documents_pending', 'ready_for_review', 'submitted', 'approved', 'disbursed', 'closed'];
    sortedStatuses.sort((a, b) => {
      const idxA = LIFECYCLE_ORDER.indexOf(a);
      const idxB = LIFECYCLE_ORDER.indexOf(b);
      const valA = idxA === -1 ? 999 : idxA;
      const valB = idxB === -1 ? 999 : idxB;
      return valA - valB || a.localeCompare(b);
    });
  }

  filterEl.innerHTML = '<option value="all">All Statuses</option>';
  sortedStatuses.forEach(st => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = isDirectOutreach
      ? formatWhatsAppDeliveryStatus(st)
      : formatStatus(st);
    filterEl.appendChild(opt);
  });

  if (statusSet.has(currentVal) || currentVal === "all") {
    filterEl.value = currentVal;
  } else {
    filterEl.value = "all";
    statusFilter = "all";
  }

  if (typeof UI !== 'undefined' && UI.replaceSelect) {
    UI.replaceSelect(filterEl);
  }
}

let currentPage = 1;
const pageSize = 10;

function renderPaginationControls(totalItems) {
  const container = el("paginationPages");
  if (!container) return;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  container.innerHTML = "";

  // Prev Button
  const prevBtn = document.createElement("button");
  prevBtn.type = "button";
  prevBtn.className = "page-nav-btn";
  prevBtn.textContent = "<";
  prevBtn.disabled = currentPage === 1;
  prevBtn.style.opacity = currentPage === 1 ? "0.4" : "1";
  prevBtn.style.cursor = currentPage === 1 ? "default" : "pointer";
  prevBtn.onclick = () => {
    if (currentPage > 1) {
      currentPage--;
      render();
    }
  };
  container.appendChild(prevBtn);

  // Page Numbers
  for (let i = 1; i <= totalPages; i++) {
    const pageBtn = document.createElement("button");
    pageBtn.type = "button";
    pageBtn.className = i === currentPage ? "page-nav-btn active" : "page-nav-btn";
    pageBtn.textContent = i;
    pageBtn.onclick = () => {
      currentPage = i;
      render();
    };
    container.appendChild(pageBtn);
  }

  // Next Button
  const nextBtn = document.createElement("button");
  nextBtn.type = "button";
  nextBtn.className = "page-nav-btn";
  nextBtn.textContent = ">";
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.style.opacity = currentPage === totalPages ? "0.4" : "1";
  nextBtn.style.cursor = currentPage === totalPages ? "default" : "pointer";
  nextBtn.onclick = () => {
    if (currentPage < totalPages) {
      currentPage++;
      render();
    }
  };
  container.appendChild(nextBtn);
}

function debounce(func, wait = 250) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

async function copyCaseUploadLink(token, btn) {
  if (!token) {
    if (typeof UI !== 'undefined') UI.toast("Upload link not available for this case.", "warning");
    return;
  }
  const url = `${window.location.origin}/upload.html?t=${token}`;
  try {
    await navigator.clipboard.writeText(url);
    if (btn) {
      const orig = btn.innerHTML;
      btn.classList.add("copied");
      btn.innerHTML = "<span>✓ Copied!</span>";
      setTimeout(() => {
        btn.classList.remove("copied");
        btn.innerHTML = orig;
      }, 2000);
    }
    if (typeof UI !== 'undefined') UI.toast("Client upload link copied to clipboard!", "success");
  } catch (e) {
    if (typeof UI !== 'undefined') UI.prompt({ title: "Upload Link", message: "Copy client upload link below:", defaultValue: url });
  }
}

function isCaseForPersona(c, persona) {
  const prod = String(c.loanProduct || '').trim().toLowerCase();
  const totalDocs = c.docProgress?.total !== undefined ? c.docProgress.total : (c.docRequirements ? c.docRequirements.length : 0);
  const isDirectOutreach = (
    totalDocs === 0 || 
    Boolean(c.noDocs) || 
    Boolean(c.noDocsRequired) || 
    prod.includes('hello_world') || 
    prod.includes('new_convo_1') || 
    prod.includes('outreach') || 
    prod.includes('announcement') || 
    prod.includes('notice') ||
    (Array.isArray(cachedTemplates) && cachedTemplates.some(t => t.name.toLowerCase() === prod))
  );

  if (persona === 'direct_outreach') {
    return isDirectOutreach;
  }

  if (isDirectOutreach) return false;

  const isLoanProduct = (
    prod.includes('working capital') ||
    prod.includes('term loan') ||
    prod.includes('machinery') ||
    prod.includes('equipment') ||
    prod.includes('property') ||
    prod.includes('lap') ||
    prod.includes('cash credit') ||
    prod.includes('overdraft') ||
    prod.includes('invoice financing') ||
    prod.includes('home loan') ||
    prod.includes('business loan') ||
    prod.includes('personal loan')
  );

  const isCaProduct = (
    prod.includes('gst') ||
    prod.includes('itr') ||
    prod.includes('tax') ||
    prod.includes('audit') ||
    prod.includes('filing') ||
    prod.includes('salaried') ||
    prod.includes('capital gains')
  );

  if (persona === 'ca') {
    if (isLoanProduct && !isCaProduct) return false;
    return true;
  }

  if (persona === 'loan_agent') {
    if (isCaProduct && !isLoanProduct) return false;
    return true;
  }

  return true;
}

function render() {
  const tbody = el("tbody");
  const q = el("search").value.trim().toLowerCase();
  const selectedStatus = statusFilter || "all";
  const selectedLoanType = el("loanTypeFilter") ? el("loanTypeFilter").value : "all";
  const selectedAmount = el("amountFilter") ? el("amountFilter").value : "all";
  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';

  updateSummary();

  const tPending = el("triageCardPending");
  const tReview = el("triageCardReview");
  if (tPending) tPending.classList.toggle("active-filter", selectedStatus === "documents_pending");
  if (tReview) tReview.classList.toggle("active-filter", selectedStatus === "ready_for_review");

  const tSent = el("triageCardSent");
  const tDeliv = el("triageCardDelivered");
  const tRead = el("triageCardRead");
  const tReplied = el("triageCardReplied");
  if (tSent) tSent.classList.toggle("active-filter", selectedStatus === "sent");
  if (tDeliv) tDeliv.classList.toggle("active-filter", selectedStatus === "delivered");
  if (tRead) tRead.classList.toggle("active-filter", selectedStatus === "read");
  if (tReplied) tReplied.classList.toggle("active-filter", selectedStatus === "replied");

  const filtered = allCases.filter(c => {
    if (!isCaseForPersona(c, persona)) return false;
    const displayStatus = getDisplayStatus(c, persona);
    if (selectedStatus !== "all" && displayStatus !== selectedStatus) return false;
    if (selectedLoanType !== "all" && (c.loanProduct || "").trim() !== selectedLoanType) return false;
    if (selectedAmount !== "all") {
      const amt = parseFloat(c.amountRequired || 0);
      if (selectedAmount === "0-25" && (amt < 0 || amt > 25)) return false;
      if (selectedAmount === "25-50" && (amt < 25 || amt > 50)) return false;
      if (selectedAmount === "50+" && amt < 50) return false;
    }
    if (q) {
      const matchContact = (c.contactPerson || "").toLowerCase().includes(q);
      const matchPhone = (c.phone || "").toLowerCase().includes(q);
      const matchProduct = (c.loanProduct || "").toLowerCase().includes(q);
      const matchId = (c.id || "").toLowerCase().includes(q);
      return matchContact || matchPhone || matchProduct || matchId;
    }
    return true;
  });

  const totalItems = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (currentPage > totalPages) currentPage = totalPages;
  const startIdx = totalItems > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endIdx = Math.min(currentPage * pageSize, totalItems);

  // Update Footer Count & Pagination Bar (only shown when exceeding 1 page limit)
  const footerCountEl = el("footerCasesCount");
  const paginationFooterEl = footerCountEl ? footerCountEl.closest(".table-pagination-footer") : null;

  if (totalItems <= pageSize) {
    if (footerCountEl) footerCountEl.style.display = "none";
    if (paginationFooterEl) paginationFooterEl.style.display = "none";
  } else {
    if (footerCountEl) {
      footerCountEl.style.display = "";
      footerCountEl.textContent = `Showing ${startIdx} to ${endIdx} of ${totalItems} cases`;
    }
    if (paginationFooterEl) paginationFooterEl.style.display = "";
  }

  renderPaginationControls(totalItems);

  const isCa = (persona === 'ca');
  const isDirectOutreach = (persona === 'direct_outreach');

  const thIndex = el("thIndex");
  const thCustomer = el("thCustomer");
  const thCategory = el("thCategory");
  const thAmount = el("thAmount");
  const thDocProgress = el("thDocProgress");
  const thNextAction = el("thNextAction");
  const thStatus = el("thStatus");
  const thAction = el("thAction");

  if (isDirectOutreach) {
    if (thIndex) { thIndex.hidden = false; thIndex.style.display = ""; thIndex.style.width = "6%"; }
    if (thCustomer) { thCustomer.hidden = false; thCustomer.style.display = ""; thCustomer.style.width = "44%"; }
    if (thCategory) { thCategory.hidden = false; thCategory.style.display = ""; thCategory.style.width = "32%"; }
    if (thStatus) { thStatus.hidden = false; thStatus.style.display = ""; thStatus.style.width = "18%"; }
    if (thAmount) { thAmount.hidden = true; thAmount.style.display = "none"; }
    if (thDocProgress) { thDocProgress.hidden = true; thDocProgress.style.display = "none"; }
    if (thNextAction) { thNextAction.hidden = true; thNextAction.style.display = "none"; }
    if (thAction) { thAction.hidden = true; thAction.style.display = "none"; }
  } else if (isCa) {
    if (thIndex) { thIndex.hidden = false; thIndex.style.display = ""; thIndex.style.width = "4%"; }
    if (thCustomer) { thCustomer.hidden = false; thCustomer.style.display = ""; thCustomer.style.width = "24%"; }
    if (thCategory) { thCategory.hidden = false; thCategory.style.display = ""; thCategory.style.width = "18%"; }
    if (thAmount) { thAmount.hidden = true; thAmount.style.display = "none"; }
    if (thDocProgress) { thDocProgress.hidden = false; thDocProgress.style.display = ""; thDocProgress.style.width = "18%"; }
    if (thNextAction) { thNextAction.hidden = false; thNextAction.style.display = ""; thNextAction.style.width = "18%"; }
    if (thStatus) { thStatus.hidden = false; thStatus.style.display = ""; thStatus.style.width = "14%"; }
    if (thAction) { thAction.hidden = false; thAction.style.display = ""; thAction.style.width = "4%"; }
  } else {
    if (thIndex) { thIndex.hidden = false; thIndex.style.display = ""; thIndex.style.width = "4%"; }
    if (thCustomer) { thCustomer.hidden = false; thCustomer.style.display = ""; thCustomer.style.width = "22%"; }
    if (thCategory) { thCategory.hidden = false; thCategory.style.display = ""; thCategory.style.width = "18%"; }
    if (thAmount) { thAmount.hidden = false; thAmount.style.display = ""; thAmount.style.width = "14%"; }
    if (thDocProgress) { thDocProgress.hidden = false; thDocProgress.style.display = ""; thDocProgress.style.width = "18%"; }
    if (thNextAction) { thNextAction.hidden = false; thNextAction.style.display = ""; thNextAction.style.width = "18%"; }
    if (thStatus) { thStatus.hidden = false; thStatus.style.display = ""; thStatus.style.width = "10%"; }
    if (thAction) { thAction.hidden = false; thAction.style.display = ""; thAction.style.width = "4%"; }
  }

  const amtSelect = el("amountFilter");
  if (amtSelect) {
    amtSelect.hidden = isCa || isDirectOutreach;
    const wrapper = amtSelect.closest(".ui-select-wrapper");
    if (wrapper) wrapper.style.display = (isDirectOutreach || isCa) ? "none" : (isCa ? "none" : "");
  }

  const typeSelect = el("loanTypeFilter");
  if (typeSelect) {
    typeSelect.hidden = isCa;
    const wrapper = typeSelect.closest(".ui-select-wrapper");
    if (wrapper) wrapper.style.display = isCa ? "none" : "";
  }

  const statusSelect = el("statusFilter");
  if (statusSelect) {
    statusSelect.hidden = false;
    const wrapper = statusSelect.closest(".ui-select-wrapper");
    if (wrapper) wrapper.style.display = "";
  }

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    let emptyTitle = "No matching loan cases found";
    let colSpan = 8;
    if (isDirectOutreach) {
      emptyTitle = "No matching direct outreach targets found";
      colSpan = 4;
    } else if (isCa) {
      emptyTitle = "No matching client files found";
      colSpan = 7;
    }
    tbody.innerHTML = `
      <tr>
        <td colspan="${colSpan}">
          <div class="empty-state-card">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">${emptyTitle}</div>
            <div class="empty-state-sub">Try searching with a different client name, mobile number, or adjusting your status filter.</div>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const pagedCases = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  pagedCases.forEach((c, idx) => {
    const tr = document.createElement("tr");
    tr.className = "case-row";
    tr.style.cursor = "pointer";
    const prog = c.docProgress || { fulfilled: 0, total: 0 };
    const pct = prog.total > 0 ? Math.round((prog.fulfilled / prog.total) * 100) : 0;
    const progressColor = pct === 100 ? '#10b981' : (pct > 0 ? '#f59e0b' : '#cbd5e1');

    const nextAction = getNextActionDisplay(c);
    const initials = getInitials(c.contactPerson);
    const avatarStyle = getAvatarStyle(c.contactPerson);
    const absoluteIdx = (currentPage - 1) * pageSize + idx + 1;

    const isDirectOutreach = (persona === 'direct_outreach');
    const displayStatus = getDisplayStatus(c, persona);

    if (isDirectOutreach) {
      tr.innerHTML = `
        <td style="color: #94a3b8; font-weight: 500; font-size: 0.8125rem; text-align: center;">${absoluteIdx}</td>
        <td>
          <div class="customer-cell">
            <div class="avatar-wrapper">
              <div class="avatar-circle-sm" style="${avatarStyle}">
                ${initials}
              </div>
            </div>
            <div>
              <div class="customer-info-name">
                ${escapeHtml(c.contactPerson || '—')}
                ${c.isDemo ? '<span class="tag" style="font-size: 0.65rem; background: #e0e7ff; color: #3730a3; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px;">Demo</span>' : ''}
              </div>
              <div class="customer-info-sub">${escapeHtml(maskPhone(c.phone))}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="loan-type-main">${escapeHtml(c.loanProduct || c.templateName || c.messageTemplate || 'Unspecified')}</div>
        </td>
        <td>
          ${getWhatsAppDeliveryBadgeHtml(displayStatus)}
        </td>
      `;
    } else {
      const amountTd = isCa ? '' : `
        <td>
          <div class="amount-val">${formatAmountDisplay(c.amountRequired)}</div>
        </td>
      `;

      tr.innerHTML = `
        <td style="color: #94a3b8; font-weight: 500; font-size: 0.8125rem; text-align: center;">${absoluteIdx}</td>
        <td>
          <div class="customer-cell">
            <div class="avatar-wrapper">
              <div class="avatar-circle-sm" style="${avatarStyle}">
                ${initials}
              </div>
            </div>
            <div>
              <div class="customer-info-name">
                ${escapeHtml(c.contactPerson || '—')}
                ${c.isDemo ? '<span class="tag" style="font-size: 0.65rem; background: #e0e7ff; color: #3730a3; font-weight: 700; padding: 0.1rem 0.4rem; border-radius: 4px;">Demo</span>' : ''}
              </div>
              <div class="customer-info-sub">${escapeHtml(maskPhone(c.phone))}</div>
            </div>
          </div>
        </td>
        <td>
          <div class="loan-type-main">${escapeHtml(c.loanProduct || 'Unspecified')}</div>
        </td>
        ${amountTd}
        <td>
          ${prog.total > 0 ? `
            <div class="doc-prog-wrapper">
              <div style="flex: 1;">
                <div class="seg-progress-bar" title="${prog.fulfilled} of ${prog.total} documents received">
                  ${Array.from({length: Math.max(1, prog.total)}, (_, i) => `<div class="seg-bar ${i < prog.fulfilled ? 'filled' : ''}"></div>`).join('')}
                </div>
                <div class="doc-prog-sub">${prog.fulfilled} of ${prog.total} docs</div>
              </div>
            </div>
          ` : `
            <span class="badge" style="background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0;">No Docs Required</span>
          `}
        </td>
        <td>
          <div class="next-action-main" style="color: ${nextAction.color};">
            ${escapeHtml(nextAction.main)}
          </div>
        </td>
        <td>
          <span class="badge badge-${displayStatus}">${formatStatus(displayStatus)}</span>
        </td>
        <td style="text-align: center;" onclick="event.stopPropagation();">
          ${prog.total > 0 ? `
            <button type="button" class="row-copy-btn" title="Copy Client Upload Link" onclick="copyCaseUploadLink('${c.token}', this)">
              📋 Copy Link
            </button>
          ` : `
            <span style="font-size: 0.8125rem; color: #64748b;">${escapeHtml(maskPhone(c.phone))}</span>
          `}
        </td>
      `;
    }

    tr.addEventListener("click", () => {
      window.location.href = `/case.html?id=${c.id}`;
    });

    tbody.appendChild(tr);
  });

}

function buildCaseDrawerHtml(c) {
  const reqs = c.docRequirements || [];
  const prog = c.docProgress || { fulfilled: 0, total: 0 };
  const allDocsSubmitted = prog.total > 0 && prog.fulfilled >= prog.total;
  const hasSomeSubmitted = prog.fulfilled > 0;

  let docsHtml = "";
  if (reqs.length === 0) {
    docsHtml = '<p style="color: #64748b; font-size: 0.8125rem;">No document requirements configured for this case.</p>';
  } else {
    docsHtml = `<div class="doc-req-list">`;
    reqs.forEach(req => {
      const uploads = req.uploads || [];
      const hasUploads = uploads.length > 0;
      const isReceived = req.status === 'received' || hasUploads;

      docsHtml += `
        <div class="doc-req-item">
          <div class="doc-req-header">
            <span>${escapeHtml(getDocumentLabel(req))}</span>
            <span class="badge ${isReceived ? 'badge-approved' : 'badge-lead'}" style="font-size: 0.7rem;">
              ${isReceived ? 'Received' : 'Pending'}
            </span>
          </div>
      `;

      if (hasUploads) {
        uploads.forEach(up => {
          let ocrDetails = "";
          if (up.ocr && up.ocr.fields) {
            const fieldPairs = Object.entries(up.ocr.fields).map(([k, v]) => `${k}: ${v}`).slice(0, 3).join(" | ");

            if (fieldPairs) {
              ocrDetails = `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;"><strong>OCR Extracted:</strong> ${escapeHtml(fieldPairs)}</div>`;
            }
          }

          docsHtml += `
            <div class="uploaded-file-row">
              <div>
                <strong>${escapeHtml(up.fileLabel || 'Uploaded File')}</strong>
                <span class="tag" style="font-size: 0.65rem; margin-left: 0.35rem;">OCR ${up.ocrStatus || 'processed'}</span>
                ${ocrDetails}
              </div>
              <div style="display: flex; gap: 0.5rem; align-items: center;">
                ${up.link ? `<a href="${up.link}" target="_blank" class="file-view-link">View Submitted File</a>` : ''}
                <button type="button" class="btn-reject-file" onclick="rejectFile('${up.id}')">Reject</button>
              </div>
            </div>
          `;
        });
      } else {
        docsHtml += `<p style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.35rem;">No files submitted yet by client.</p>`;
      }

      docsHtml += `</div>`;
    });
    docsHtml += `</div>`;
  }

  const statuses = [
    { id: 'documents_pending', label: 'Documents Pending' },
    { id: 'ready_for_review', label: 'Ready for Review' },
    { id: 'submitted', label: 'Submitted' },
    // { id: 'lender_query', label: 'Lender Query' },
    // { id: 'approved', label: 'Approved' },
    // { id: 'disbursed', label: 'Disbursed' },
    { id: 'closed', label: 'Closed' }
  ];

  let statusOptions = statuses.map(s =>
    `<option value="${s.id}" ${c.status === s.id ? 'selected' : ''}>${s.label}</option>`
  ).join("");

  const isDirectOutreach = (prog.total === 0 || reqs.length === 0 || c.noDocsRequired || c.noDocs);

  const docsCardHtml = isDirectOutreach ? `
    <div class="drawer-card">
      <div class="drawer-card-title">
        <span>💬 WhatsApp Outreach Conversation</span>
      </div>
      <div class="timeline-mini-list" id="drawer-wa-thread-${c.id}">
        <p style="color: #94a3b8; font-size: 0.75rem;">Loading WhatsApp thread...</p>
      </div>
      <form style="margin-top: 0.75rem; display: flex; gap: 0.5rem;" onsubmit="handleDrawerDirectWhatsAppSend(event, '${c.id}')">
        <input type="text" id="drawer-wa-input-${c.id}" placeholder="Type WhatsApp message to send..." style="flex: 1; font-size: 0.8125rem; padding: 0.4rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px;" required />
        <button type="submit" class="btn btn-primary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem;">Send ➔</button>
      </form>
    </div>
  ` : `
    <div class="drawer-card">
      <div class="drawer-card-title">
        <span>Case Documents (${prog.fulfilled}/${prog.total} Requirements Fulfilled)</span>
        ${allDocsSubmitted ? `<span class="badge badge-approved" style="font-size: 0.7rem;">100% Complete</span>` : ''}
      </div>
      ${docsHtml}
    </div>
  `;

  return `
    <div class="case-drawer">
      ${docsCardHtml}

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="drawer-card">
          <div class="drawer-card-title">
            <span>Case Management</span>
          </div>
          <div style="margin-bottom: 0.75rem;">
            <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 0.25rem;">Update Case Status</label>
            <select class="filter-select" style="width: 100%; font-size: 0.8125rem;" onchange="updateCaseStatus('${c.id}', this.value)">
              ${statusOptions}
            </select>
          </div>
          ${(c.token && !isDirectOutreach) ? `
            <div style="margin-bottom: 0.5rem;">
              <label style="font-size: 0.75rem; font-weight: 600; color: #64748b; display: block; margin-bottom: 0.25rem;">Client Upload Link</label>
              <input type="text" readonly value="${window.location.origin}/upload.html?t=${c.token}" style="font-size: 0.75rem; padding: 0.35rem 0.5rem; background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 4px; width: 100%; color: #334155;" onclick="this.select()" />
            </div>
          ` : ''}
        </div>

        <div class="drawer-card">
          <div class="drawer-card-title">
            <span>Case Timeline & Notes</span>
          </div>
          <div class="timeline-mini-list" id="drawer-timeline-${c.id}">
            <p style="color: #94a3b8; font-size: 0.75rem;">Loading timeline stream...</p>
          </div>
          <div style="margin-top: 0.75rem; display: flex; gap: 0.5rem;">
            <input type="text" id="note-input-${c.id}" placeholder="Type internal note..." style="flex: 1; font-size: 0.8125rem; padding: 0.4rem 0.6rem; border: 1px solid #cbd5e1; border-radius: 4px;" />
            <button type="button" class="btn btn-primary" style="padding: 0.4rem 0.75rem; font-size: 0.75rem;" onclick="addNote('${c.id}')">Add Note</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

async function generateReport(caseId, btn) {
  if (btn) btn.disabled = true;

  try {
    const res = await authFetch(`/api/cases/${caseId}/generate-report`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to generate report");

    await load();
    openReportModal(caseId);
  } catch (err) {
    UI.toast("Report Generation Error: " + err.message, "error");
  } finally {
    if (btn) btn.disabled = false;
  }
}

function openReportModal(caseId) {
  const c = allCases.find(item => item.id === caseId);
  if (!c || !c.aiReport) {
    UI.toast("Report data not found for this case.", "warning");
    return;
  }

  const r = c.aiReport;
  const body = el("reportModalBody");

  const scoreColor = r.readinessScore >= 85 ? "#059669" : r.readinessScore >= 75 ? "#d97706" : "#dc2626";
  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const readinessHeading = persona === 'ca' ? "Filing & Audit Readiness" : "Loan Approval Readiness";
  const amountText = (persona === 'loan_agent' || c.amountRequired) ? ` | Amount: <strong>${formatLacs(c.amountRequired)}</strong>` : '';

  body.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">${readinessHeading}</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">${escapeHtml(r.readinessGrade)}</div>
        <div style="font-size: 0.8125rem; color: #475569; margin-top: 0.25rem;">Client: <strong>${escapeHtml(c.contactPerson)}</strong> | Product: <strong>${escapeHtml(c.loanProduct)}</strong>${amountText}</div>
      </div>
      <div style="text-align: center; background: #ffffff; border: 2px solid ${scoreColor}; padding: 0.75rem 1.25rem; border-radius: 12px;">
        <div style="font-size: 1.75rem; font-weight: 800; color: ${scoreColor};">${r.readinessScore}</div>
        <div style="font-size: 0.65rem; font-weight: 700; color: #64748b; text-transform: uppercase;">Out of 100</div>
      </div>
    </div>

    <div style="margin-bottom: 1rem;">
      <h4 style="font-size: 0.875rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Executive Credit Summary</h4>
      <div style="font-size: 0.875rem; color: #334155; line-height: 1.5; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.875rem; border-radius: 6px;">
        ${escapeHtml(r.executiveSummary)}
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.875rem;">
        <h4 style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem;">Verified Entities & Documents</h4>
        <ul style="padding-left: 1.25rem; font-size: 0.8125rem; color: #334155; line-height: 1.6;">
          ${(r.verifiedEntities || []).map(v => `<li>${escapeHtml(v)}</li>`).join("")}
        </ul>
      </div>

      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.875rem;">
        <h4 style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; margin-bottom: 0.5rem;">Recommended Lender Alignment</h4>
        <ul style="padding-left: 1.25rem; font-size: 0.8125rem; color: #2563eb; font-weight: 500; line-height: 1.6;">
          ${(r.recommendedLenders || []).map(l => `<li>${escapeHtml(l)}</li>`).join("")}
        </ul>
      </div>
    </div>

    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.875rem; margin-bottom: 1rem;">
      <h4 style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Risk Assessment & Mitigation</h4>
      <div style="font-size: 0.8125rem; color: #334155;">${escapeHtml(r.riskAssessment || 'No critical risks identified.')}</div>
    </div>

    <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 6px; padding: 0.875rem;">
      <h4 style="font-size: 0.8125rem; font-weight: 700; color: #0f172a; margin-bottom: 0.35rem;">Recommended Next Actions for Agent</h4>
      <ol style="padding-left: 1.25rem; font-size: 0.8125rem; color: #334155; line-height: 1.6;">
        ${(r.nextSteps || []).map(s => `<li>${escapeHtml(s)}</li>`).join("")}
      </ol>
    </div>
  `;

  el("reportModalBackdrop").hidden = false;
}

async function fetchAndRenderTimeline(caseId) {
  const container = el(`drawer-timeline-${caseId}`);
  if (!container) return;

  try {
    const res = await authFetch(`/api/cases/${caseId}/timeline`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed");

    const timeline = data.timeline || [];
    const globalWaStatus = data.whatsappDeliveryStatus || 'none';
    const globalWaError = data.whatsappErrorDetails || null;
    const waContainer = el(`drawer-wa-thread-${caseId}`);
    if (waContainer) {
      const threadEvents = timeline.filter(t => {
        const content = (t.content || "").toLowerCase();
        return t.event_type === 'whatsapp_sent' || t.event_type === 'whatsapp_reply' || t.event_type === 'whatsapp_failed' || content.includes("whatsapp");
      }).slice().reverse();

      if (threadEvents.length === 0) {
        waContainer.innerHTML = '<p style="color: #94a3b8; font-size: 0.75rem;">No WhatsApp messages sent or received yet.</p>';
      } else {
        waContainer.innerHTML = threadEvents.map(t => {
          const isClient = t.created_by === 'client' || t.event_type === 'whatsapp_reply';
          let isoStr = t.created_at || "";
          if (isoStr && !isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr = isoStr.replace(" ", "T") + "Z";
          const timeStr = isoStr ? new Date(isoStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

          if (isClient) {
            return `
              <div style="margin-bottom: 6px; text-align: left;">
                <div style="font-size: 0.65rem; color: #64748b; font-weight: 600;">Client • ${timeStr}</div>
                <div style="display: inline-block; background: #f1f5f9; color: #0f172a; padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; max-width: 90%;">
                  ${escapeHtml((t.content || "").replace(/^Client WhatsApp Reply:\s*/i, ''))}
                </div>
              </div>
            `;
          } else {
            return `
              <div style="margin-bottom: 6px; text-align: right;">
                <div style="font-size: 0.65rem; color: #166534; font-weight: 600;">Agent • ${timeStr}</div>
                <div style="display: inline-block; background: #dcfce7; color: #14532D; padding: 6px 10px; border-radius: 8px; font-size: 0.75rem; max-width: 90%;">
                  ${escapeHtml(t.content)}
                </div>
              </div>
            `;
          }
        }).join("");
      }
    }

    if (timeline.length === 0) {
      container.innerHTML = '<p style="color: #94a3b8; font-size: 0.75rem;">No timeline activity recorded yet.</p>';
      return;
    }

    container.innerHTML = timeline.map((t, idx) => {
      let isoStr = t.created_at || "";
      if (isoStr && !isoStr.endsWith("Z") && !isoStr.includes("+")) {
        isoStr = isoStr.replace(" ", "T") + "Z";
      }
      const formattedTime = isoStr ? new Date(isoStr).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      }) : "";

      const contentLower = (t.content || "").toLowerCase();
      const isWhatsAppEvent = t.event_type === 'whatsapp_sent' || t.event_type === 'whatsapp_failed' || contentLower.includes("whatsapp");
      const isWhatsAppFailure = t.event_type === 'whatsapp_failed' || (contentLower.includes("whatsapp") && (contentLower.includes("fail") || contentLower.includes("error")));

      let itemMeta = null;
      try {
        if (t.metadata) itemMeta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
      } catch(e) {}

      const isFailed = (globalWaStatus === 'failed') || isWhatsAppFailure || (itemMeta && itemMeta.whatsapp_status === 'failed');
      const itemWaStatus = (itemMeta && itemMeta.whatsapp_status) ? itemMeta.whatsapp_status : (isWhatsAppEvent ? (isWhatsAppFailure ? 'failed' : 'sent') : globalWaStatus);

      let waBadgeHtml = "";
      if (itemWaStatus === 'sent' || t.event_type === 'whatsapp_sent') {
        waBadgeHtml = `<span style="font-size: 0.65rem; background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">WhatsApp: Sent</span>`;
      } else if (itemWaStatus === 'failed' || isFailed) {
        waBadgeHtml = `<span style="font-size: 0.65rem; background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">WhatsApp: Failed</span>`;
      } else if (itemWaStatus === 'sending' || itemWaStatus === 'pending') {
        waBadgeHtml = `<span style="font-size: 0.65rem; background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-weight: 600; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">WhatsApp: Sending</span>`;
      }

      let errorBannerHtml = "";
      if (isFailed && (idx === 0 || isWhatsAppFailure || t.event_type === 'case_created')) {
        const errorText = globalWaError || (itemMeta && itemMeta.error) || "WhatsApp message delivery failed. Meta Cloud API dispatch unfulfilled.";
        errorBannerHtml = `
          <div style="margin-top: 6px; padding: 6px 10px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
            <div style="font-size: 0.725rem; color: #991B1B; font-weight: 500; flex: 1;">
              ⚠️ <strong>Error:</strong> ${escapeHtml(errorText)}
            </div>
            <button type="button" onclick="handleDrawerRetryWhatsApp('${caseId}')" style="background: #DC2626; color: #ffffff; border: none; font-size: 0.6875rem; font-weight: 600; padding: 3px 8px; border-radius: 4px; cursor: pointer; white-space: nowrap;">
              🔄 Retry WhatsApp
            </button>
          </div>
        `;
      }

      return `
        <div class="timeline-mini-item" style="display: block;">
          <div>${escapeHtml(t.content)} ${waBadgeHtml}</div>
          <div class="timeline-mini-time">${formattedTime} ${t.created_by ? `· by ${escapeHtml(t.created_by)}` : ''}</div>
          ${errorBannerHtml}
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 0.75rem;">Could not load timeline history.</p>';
  }
}

async function handleDrawerRetryWhatsApp(caseId) {
  if (!caseId) return;
  const confirmRetry = await UI.confirm({
    title: "Retry WhatsApp Message",
    message: "Retry sending WhatsApp message to client?",
    confirmText: "Retry WhatsApp",
    isDanger: false
  });
  if (!confirmRetry) return;

  try {
    const res = await authFetch(`/api/cases/${caseId}/retry-whatsapp`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.success) {
      UI.toast(data.message || "WhatsApp message sent successfully!", "success");
    } else {
      UI.toast(data.error || "Failed to send WhatsApp message.", "error");
    }
  } catch (e) {
    UI.toast(`Error sending WhatsApp message: ${e.message}`, "error");
  } finally {
    await load();
    fetchAndRenderTimeline(caseId);
  }
}

async function handleDrawerDirectWhatsAppSend(e, caseId) {
  if (e) e.preventDefault();
  const input = document.getElementById(`drawer-wa-input-${caseId}`);
  if (!input || !input.value.trim()) return;

  const msg = input.value.trim();
  input.value = "";

  try {
    const res = await authFetch(`/api/cases/${caseId}/send-whatsapp-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    if (res.ok && data.success) {
      UI.toast("WhatsApp message sent!", "success");
    } else {
      UI.toast(data.error || "Failed to send WhatsApp message.", "error");
    }
  } catch (err) {
    UI.toast("Error sending message: " + err.message, "error");
  } finally {
    await load();
    fetchAndRenderTimeline(caseId);
  }
}

async function updateCaseStatus(caseId, newStatus) {
  try {
    const res = await authFetch(`/api/cases/${caseId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not update status");
    UI.toast(`Status updated to ${formatStatus(newStatus)}`, "success");
    await load();
  } catch (err) {
    UI.toast("Status Update Error: " + err.message, "error");
  }
}

async function rejectFile(uploadId) {
  const ok = await UI.confirm({
    title: "Reject Document",
    message: "Are you sure you want to reject this submitted document file?",
    confirmText: "Reject File",
    isDanger: true
  });
  if (!ok) return;

  try {
    const res = await authFetch("/api/reject-upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not reject file");
    UI.toast("Document rejected successfully.", "info");
    await load();
  } catch (err) {
    UI.toast("Rejection Error: " + err.message, "error");
  }
}

async function addNote(caseId) {
  const input = el(`note-input-${caseId}`);
  if (!input) return;
  const note = input.value.trim();
  if (!note) return;

  try {
    const res = await authFetch(`/api/cases/${caseId}/timeline`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save note");
    input.value = "";
    UI.toast("Note added to case timeline.", "success");
    fetchAndRenderTimeline(caseId);
  } catch (err) {
    UI.toast("Note Error: " + err.message, "error");
  }
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function updateSummary(summary) {
  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const isDirectOutreach = (persona === 'direct_outreach');
  const personaCases = (allCases || []).filter(c => isCaseForPersona(c, persona));

  const total = summary && summary.total !== undefined ? summary.total : personaCases.length;
  const tot = el("statTotal"); if (tot) tot.textContent = total;

  if (isDirectOutreach) {
    const sentCount = personaCases.filter(c => getDisplayStatus(c, persona) === 'sent').length;
    const delivCount = personaCases.filter(c => getDisplayStatus(c, persona) === 'delivered').length;
    const readCount = personaCases.filter(c => getDisplayStatus(c, persona) === 'read').length;
    const repCount = personaCases.filter(c => getDisplayStatus(c, persona) === 'replied').length;

    const sSent = el("statSent"); if (sSent) sSent.textContent = sentCount;
    const sDeliv = el("statDelivered"); if (sDeliv) sDeliv.textContent = delivCount;
    const sRead = el("statRead"); if (sRead) sRead.textContent = readCount;
    const sRep = el("statReplied"); if (sRep) sRep.textContent = repCount;
  } else {
    const docsPending = summary && summary.documentsPending !== undefined ? summary.documentsPending : personaCases.filter(c => c.status === 'documents_pending' || c.status === 'lead').length;
    const readyForReview = summary && summary.readyForReview !== undefined ? summary.readyForReview : personaCases.filter(c => c.status === 'ready_for_review').length;
    const submitted = summary && summary.submitted !== undefined ? summary.submitted : personaCases.filter(c => c.status === 'submitted').length;
    const disbursed = summary && summary.disbursed !== undefined ? summary.disbursed : personaCases.filter(c => c.status === 'disbursed').length;

    const pen = el("statPending"); if (pen) pen.textContent = docsPending;
    const rev = el("statReview"); if (rev) rev.textContent = readyForReview;
    const sub = el("statSubmitted"); if (sub) sub.textContent = submitted;
    const dis = el("statDisbursed"); if (dis) dis.textContent = disbursed;
  }
}

async function loadLoanProducts() {
  try {
    const res = await authFetch("/api/loan-products");
    const data = await res.json().catch(() => ({}));
    const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
    
    if (persona === 'direct_outreach') {
      loanProductsList = [
        { id: 'announcement', label: 'General Announcement (hello_world)' },
        { id: 'notice', label: 'Client Update Notice (new_convo_1)' },
        { id: 'custom_outreach', label: 'Custom Outreach' }
      ];
    } else if (persona === 'ca') {
      loanProductsList = [
        { id: 'gst_monthly', label: 'GST — Monthly (GSTR-1 & 3B)' },
        { id: 'gst_annual', label: 'GST — Annual Return (GSTR-9 & 9C)' },
        { id: 'gst_reg', label: 'GST — Registration Intake' },
        { id: 'itr_salaried', label: 'ITR — Salaried (ITR-1 / 2)' },
        { id: 'itr_business', label: 'ITR — Business (ITR-3 / 4)' },
        { id: 'itr_nri', label: 'ITR — Capital Gains & NRI' },
        { id: 'itr_audit', label: 'ITR — Tax Audit (Form 3CD)' }
      ];
    } else {
      loanProductsList = (data.loanProducts && data.loanProducts.length > 0)
        ? data.loanProducts
        : [
            { id: 'home_loan', label: 'Home Loan Pack' },
            { id: 'lap', label: 'LAP (Property Loan)' },
            { id: 'business_loan', label: 'Business Loan' },
            { id: 'personal_loan', label: 'Personal Loan Pack' }
          ];
    }
    renderLoanProductSelect();
  } catch (e) {
    console.error("Failed loading loan products", e);
  }
}

let wizardState = {
  screen: 'details', // 'details' | 'documents' | 'success'
  customer: { contactPerson: '', phone: '' },
  loan: { product: '', amountRequired: null },
  documents: { selectedIds: [] },
  schedule: null,
  generatedCase: null
};

function setWizardScreen(screenName) {
  wizardState.screen = screenName;
  const modal = el("wizardModal");
  if (modal) modal.setAttribute("data-active-screen", screenName);

  document.querySelectorAll(".wizard-screen").forEach(s => {
    s.hidden = s.getAttribute("data-screen") !== screenName;
  });
}

let loanProductMappings = {
  "GST — Monthly (GSTR-1 & 3B)": ["pan", "bank_statement", "gst_returns", "invoices"],
  "GST — Annual Return (GSTR-9 & 9C)": ["pan", "bank_statement", "gst_returns", "itr"],
  "GST — Registration Intake": ["pan", "aadhaar", "bank_statement", "property_docs"],
  "ITR — Salaried (ITR-1 / 2)": ["pan", "aadhaar", "bank_statement", "itr"],
  "ITR — Business (ITR-3 / 4)": ["pan", "aadhaar", "bank_statement", "gst_returns", "itr"],
  "ITR — Capital Gains & NRI": ["pan", "aadhaar", "bank_statement", "property_docs", "itr"],
  "ITR — Tax Audit (Form 3CD)": ["pan", "aadhaar", "bank_statement", "gst_returns", "itr", "property_docs"]
};

async function loadProductMappings() {
  try {
    const res = await authFetch("/api/loan-product-mappings");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.mappings) {
      loanProductMappings = { ...loanProductMappings, ...data.mappings };
    }
  } catch (e) {
    console.error("Failed loading loan product mappings", e);
  }
}

function getRecommendedDocsForProduct(prodLabel) {
  if (!documentCatalog || documentCatalog.length === 0) {
    return [
      { id: 'pan', label: 'PAN Card' },
      { id: 'aadhaar', label: 'Aadhaar Card' },
      { id: 'bank_statement', label: 'Bank Statement' },
      { id: 'gst_returns', label: 'GST Returns' }
    ];
  }

  if (prodLabel && loanProductMappings[prodLabel] && Array.isArray(loanProductMappings[prodLabel])) {
    const recSet = new Set(loanProductMappings[prodLabel]);
    return documentCatalog.filter(d => recSet.has(d.id));
  }

  return documentCatalog.filter(d => ['pan', 'aadhaar', 'bank_statement', 'gst_returns', 'itr'].includes(d.id));
}

function updateLiveDocPreview() {
  const selectedProduct = el("loanProductSelect") ? el("loanProductSelect").value : "";
  const container = el("liveDocPreviewContainer");
  const chipsGrid = el("liveDocChipsGrid");
  const badge = el("liveDocCountBadge");
  if (!container || !chipsGrid) return;

  if (!selectedProduct || selectedProduct === "__custom__") {
    container.hidden = true;
    return;
  }

  const recommendedList = getRecommendedDocsForProduct(selectedProduct);
  if (badge) badge.textContent = `${recommendedList.length} docs`;
  chipsGrid.innerHTML = "";

  recommendedList.forEach(doc => {
    const chip = document.createElement("div");
    chip.className = "live-doc-chip";
    chip.innerHTML = `<span class="chip-check">✓</span> <span>${escapeHtml(doc.label)}</span>`;
    chipsGrid.appendChild(chip);
  });

  container.hidden = false;
}

function getDocIconDetails(docId) {
  switch (docId) {
    case 'pan':
      return { icon: '🪪', bgClass: 'icon-bg-green' };
    case 'aadhaar':
      return { icon: '📑', bgClass: 'icon-bg-pink' };
    case 'bank_statement':
      return { icon: '🏦', bgClass: 'icon-bg-green' };
    case 'gst_returns':
      return { icon: '📄', bgClass: 'icon-bg-purple' };
    case 'itr':
      return { icon: '📄', bgClass: 'icon-bg-blue' };
    case 'quotation':
      return { icon: '⚙️', bgClass: 'icon-bg-orange' };
    case 'property_docs':
      return { icon: '🏠', bgClass: 'icon-bg-purple' };
    case 'pending_invoices':
      return { icon: '📋', bgClass: 'icon-bg-yellow' };
    default:
      return { icon: '📄', bgClass: 'icon-bg-blue' };
  }
}

function renderScreen2DocChecklists() {
  const recContainer = el("recommendedDocsFields");
  const addContainer = el("additionalDocsFields");
  if (!recContainer || !addContainer) return;

  recContainer.innerHTML = "";
  addContainer.innerHTML = "";

  const selectedProduct = wizardState.loan.product;
  const recommendedList = getRecommendedDocsForProduct(selectedProduct);
  const recIds = new Set(recommendedList.map(r => r.id));

  let recCount = 0;
  let addCount = 0;

  documentCatalog.forEach(doc => {
    const isRec = recIds.has(doc.id);
    const iconMeta = getDocIconDetails(doc.id);

    const card = document.createElement("label");
    card.className = "doc-card-item";
    card.innerHTML = `
      <div class="doc-card-left">
        <input type="checkbox" value="${doc.id}" data-doc ${isRec ? 'checked' : ''} />
        <div class="doc-icon-box ${iconMeta.bgClass}">${iconMeta.icon}</div>
        <span class="doc-card-label">${escapeHtml(doc.label)}</span>
      </div>
    `;

    if (isRec) {
      recContainer.appendChild(card);
    } else {
      addContainer.appendChild(card);
    }
  });
}

function renderLoanProductSelect() {
  const select = el("loanProductSelect");
  if (!select) return;
  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const placeholderText = persona === 'ca' ? "Select Filing..." : "Select Collection Type...";
  select.innerHTML = `<option value="" disabled selected>${placeholderText}</option>`;

  loanProductsList.forEach(prod => {
    const opt = document.createElement("option");
    opt.value = prod.label;
    opt.textContent = prod.label;
    select.appendChild(opt);
  });

  const customOpt = document.createElement("option");
  customOpt.value = "__custom__";
  customOpt.textContent = "Other";
  select.appendChild(customOpt);
}

const loanSelectElem = el("loanProductSelect");
if (loanSelectElem) {
  loanSelectElem.addEventListener("change", (e) => {
    const customGroup = el("customProductGroup");
    if (e.target.value === "__custom__") {
      if (customGroup) customGroup.hidden = false;
      if (el("customProductInput")) el("customProductInput").focus();
    } else {
      if (customGroup) customGroup.hidden = true;
    }
    updateLiveDocPreview();
  });
}

async function loadDocumentCatalog() {
  try {
    const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
    const res = await authFetch(`/api/document-catalog?variant=${persona}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    let catalog = data.documentCatalog || [];
    if (persona === 'ca') {
      const excluded = new Set(['gst_returns', 'quotation', 'property_docs', 'invoices']);
      catalog = catalog.filter(d => !excluded.has(d.id));
    }
    documentCatalog = catalog;
    renderRequiredDocsCheckboxes();
  } catch (e) {
    console.error("Failed catalog load", e);
  }
}

function renderRequiredDocsCheckboxes() {
  const container = el("requiredDocsFields") || el("recommendedDocsFields");
  if (!container) return;
  container.innerHTML = "";
  documentCatalog.forEach(doc => {
    const label = document.createElement("label");
    label.className = "doc-check";
    label.innerHTML = `<input type="checkbox" value="${doc.id}" data-doc /> <span>${escapeHtml(doc.label)}</span>`;
    container.appendChild(label);
  });
}

async function load() {
  const dashErr = el("dashboardError");
  if (dashErr) dashErr.style.display = 'none';

  try {
    await Promise.all([loadLoanProducts(), loadDocumentCatalog(), loadProductMappings(), fetchTemplates()]);
    const res = await authFetch("/api/cases");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Unable to retrieve cases from server. Please refresh.");

    allCases = data.cases || [];
    updateSummary(data.summary || {});
    populateLoanTypeFilter();
    populateStatusFilter();
    render();

    // Initialize Custom UI Select Components for all dropdowns on page
    document.querySelectorAll("select").forEach(s => {
      if (typeof UI !== 'undefined' && UI.replaceSelect) {
        UI.replaceSelect(s);
      }
    });
  } catch (e) {
    console.error("Dashboard Load Failure:", e);
    const errMsg = e.message || "Unable to connect to server. Please verify network or authentication.";
    if (dashErr) {
      const msgEl = el("dashboardErrorMessage");
      if (msgEl) msgEl.textContent = errMsg;
      dashErr.style.display = 'flex';
    }
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(errMsg, "error");
    }
    const tbody = el("tbody");
    if (tbody) {
      const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
      const colSpan = (persona === 'ca') ? 7 : 8;
      tbody.innerHTML = `
        <tr>
          <td colspan="${colSpan}">
            <div class="empty-state-card" style="border-color: #fca5a5; background: #fff5f5;">
              <div class="empty-state-icon">⚠️</div>
              <div class="empty-state-title" style="color: #991b1b;">Dashboard Load Error</div>
              <div class="empty-state-sub" style="color: #7f1d1d;">${escapeHtml(errMsg)}</div>
              <button type="button" onclick="load()" class="btn btn-primary" style="margin-top: 1rem; background: #991b1b; border: none; cursor: pointer;">
                🔄 Retry Loading
              </button>
            </div>
          </td>
        </tr>
      `;
    }
  }
}

function showActionableError(msg, targetId = "modalErrorStep1") {
  const errBox = el(targetId) || el("modalErrorStep1") || el("modalErrorStep2") || el("modalError");
  if (errBox) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
}

// Event Listeners
const refBtn = el("refreshBtn");
if (refBtn) refBtn.addEventListener("click", load);
if (el("search")) {
  el("search").addEventListener("input", debounce(() => {
    currentPage = 1;
    render();
  }, 250));
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    const backdrop = el("modalBackdrop");
    if (backdrop && !backdrop.hidden) {
      backdrop.hidden = true;
    }
    const docMappingModal = el("docMappingModalBackdrop");
    if (docMappingModal && !docMappingModal.hidden) {
      docMappingModal.hidden = true;
    }
  }
});


const statusFilterEl = el("statusFilter");
if (statusFilterEl) {
  statusFilterEl.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    currentPage = 1;
    render();
  });
}

const triagePendingEl = el("triageCardPending");
if (triagePendingEl) {
  triagePendingEl.addEventListener("click", () => {
    if (statusFilter === "documents_pending") {
      statusFilter = "all";
    } else {
      statusFilter = "documents_pending";
    }
    const sel = el("statusFilter");
    if (sel) sel.value = statusFilter;
    currentPage = 1;
    render();
  });
}

const triageReviewEl = el("triageCardReview");
if (triageReviewEl) {
  triageReviewEl.addEventListener("click", () => {
    if (statusFilter === "ready_for_review") {
      statusFilter = "all";
    } else {
      statusFilter = "ready_for_review";
    }
    const sel = el("statusFilter");
    if (sel) sel.value = statusFilter;
    currentPage = 1;
    render();
  });
}

function bindTriageCardClick(cardId, targetStatus) {
  const cardEl = el(cardId);
  if (cardEl) {
    cardEl.addEventListener("click", () => {
      if (statusFilter === targetStatus) {
        statusFilter = "all";
      } else {
        statusFilter = targetStatus;
      }
      const sel = el("statusFilter");
      if (sel) sel.value = statusFilter;
      currentPage = 1;
      render();
    });
  }
}

bindTriageCardClick("triageCardSent", "sent");
bindTriageCardClick("triageCardDelivered", "delivered");
bindTriageCardClick("triageCardRead", "read");
bindTriageCardClick("triageCardReplied", "replied");

const loanTypeFilterEl = el("loanTypeFilter");
if (loanTypeFilterEl) {
  loanTypeFilterEl.addEventListener("change", () => {
    currentPage = 1;
    render();
  });
}

const amountFilterEl = el("amountFilter");
if (amountFilterEl) {
  amountFilterEl.addEventListener("change", () => {
    currentPage = 1;
    render();
  });
}

const loanProdSel = el("loanProductSelect");
if (loanProdSel) {
  UI.replaceSelect(loanProdSel);
}

// Open Wizard Modal
const openAddBtn = el("openAdd");
if (openAddBtn) {
  openAddBtn.addEventListener("click", () => {
    if (el("detailsForm")) detailsForm.reset();
    if (el("phone")) el("phone").classList.remove("input-error");
    if (el("contactPerson")) el("contactPerson").classList.remove("input-error");
    if (el("amountRequired")) el("amountRequired").classList.remove("input-error");
    if (el("customProductGroup")) el("customProductGroup").hidden = true;
    if (el("liveDocPreviewContainer")) el("liveDocPreviewContainer").hidden = true;
    if (el("modalErrorStep1")) el("modalErrorStep1").hidden = true;
    if (el("modalErrorStep2")) el("modalErrorStep2").hidden = true;

    clearWizardSchedule();

    const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
    const amountGroup = el("amountRequiredGroup");
    const amountInput = el("amountRequired");
    const loanGroup = el("loanProductGroup");
    const outreachGroup = el("outreachTemplateGroup");
    const continueBtn = el("btnDetailsContinue");

    const loanSelect = el("loanProductSelect");

    if (persona === 'direct_outreach') {
      if (amountGroup) {
        amountGroup.hidden = true;
        amountGroup.style.setProperty('display', 'none', 'important');
      }
      if (amountInput) amountInput.removeAttribute("required");
      if (loanGroup) {
        loanGroup.hidden = true;
        loanGroup.style.setProperty('display', 'none', 'important');
      }
      if (loanSelect) loanSelect.removeAttribute("required");
      if (outreachGroup) {
        outreachGroup.hidden = false;
        outreachGroup.style.setProperty('display', 'flex', 'important');
      }
      if (continueBtn) continueBtn.textContent = "Send Message →";
      populateOutreachTemplateDropdown();
      renderOutreachDynamicParams();
    } else if (persona === 'ca') {
      if (amountGroup) {
        amountGroup.hidden = true;
        amountGroup.style.setProperty('display', 'none', 'important');
      }
      if (amountInput) amountInput.removeAttribute("required");
      if (loanGroup) {
        loanGroup.hidden = false;
        loanGroup.style.removeProperty('display');
      }
      if (loanSelect) loanSelect.setAttribute("required", "");
      if (outreachGroup) {
        outreachGroup.hidden = true;
        outreachGroup.style.setProperty('display', 'none', 'important');
      }
      if (continueBtn) continueBtn.textContent = "Continue →";
    } else {
      if (amountGroup) {
        amountGroup.hidden = false;
        amountGroup.style.removeProperty('display');
      }
      if (amountInput) amountInput.setAttribute("required", "");
      if (loanGroup) {
        loanGroup.hidden = false;
        loanGroup.style.removeProperty('display');
      }
      if (loanSelect) loanSelect.setAttribute("required", "");
      if (outreachGroup) {
        outreachGroup.hidden = true;
        outreachGroup.style.setProperty('display', 'none', 'important');
      }
      if (continueBtn) continueBtn.textContent = "Continue →";
    }

    setWizardScreen('details');
    if (el("modalBackdrop")) el("modalBackdrop").hidden = false;
  });
}

async function populateOutreachTemplateDropdown() {
  const select = el("outreachTemplateSelect");
  if (!select) return;

  if (!cachedTemplates || cachedTemplates.length === 0) {
    await fetchTemplates();
  }

  select.innerHTML = `
    <option value="onboarding_first_message">onboarding_first_message (ITR Intake / Utility)</option>
    <option value="loan_agent_first_outreach">loan_agent_first_outreach (Loan Agent / Utility)</option>
    <option value="do_ca">do_ca (Direct Outreach / en_IN)</option>
  `;
  const seen = new Set(["onboarding_first_message", "loan_agent_first_outreach", "do_ca", "new_convo_1", "hello_world"]);
  if (Array.isArray(cachedTemplates) && cachedTemplates.length > 0) {
    cachedTemplates.forEach(t => {
      const tName = (t.name || "").toLowerCase();
      if (!seen.has(tName)) {
        seen.add(tName);
        const opt = document.createElement("option");
        opt.value = t.name;
        opt.textContent = `${t.name} (${t.category || 'Custom'})`;
        select.appendChild(opt);
      }
    });
  }

  if (typeof UI !== 'undefined' && UI.replaceSelect) {
    UI.replaceSelect(select);
  }

  renderOutreachDynamicParams();
}

function renderOutreachDynamicParams() {
  const container = el("outreachDynamicParamsContainer");
  const templateSelect = el("outreachTemplateSelect");
  if (!container || !templateSelect) return;
  container.innerHTML = "";

  const selectedName = templateSelect.value;
  if (selectedName === "onboarding_first_message") {
    const title = document.createElement("div");
    title.style.fontSize = "12px";
    title.style.fontWeight = "600";
    title.style.color = "#0F172A";
    title.style.marginBottom = "4px";
    title.textContent = "Template Variables";
    container.appendChild(title);

    const div = document.createElement("div");
    div.className = "field";
    div.style.marginBottom = "4px";
    div.innerHTML = `
      <label for="outreach_param_caname" style="font-size: 12px; font-weight: 500; color: #475569; display: block; margin-bottom: 2px;">
        CA / Firm Name <span style="font-size: 10px; color: #94A3B8;">({{caname}})</span>
      </label>
      <input type="text" id="outreach_param_caname" class="form-input outreach-dynamic-param" value="Aaryan Shah & Co" placeholder="Enter your CA firm name..." style="width: 100%; border: 1px solid #CBD5E1; border-radius: 8px; padding: 6px 10px; font-size: 13px;" />
    `;
    container.appendChild(div);
    return;
  }

  if (selectedName === "loan_agent_first_outreach") {
    const title = document.createElement("div");
    title.style.fontSize = "12px";
    title.style.fontWeight = "600";
    title.style.color = "#0F172A";
    title.style.marginBottom = "4px";
    title.textContent = "Template Variables";
    container.appendChild(title);

    const div1 = document.createElement("div");
    div1.className = "field";
    div1.style.marginBottom = "6px";
    div1.innerHTML = `
      <label for="outreach_param_username" style="font-size: 12px; font-weight: 500; color: #475569; display: block; margin-bottom: 2px;">
        Agent / Sender Name <span style="font-size: 10px; color: #94A3B8;">({{username}})</span>
      </label>
      <input type="text" id="outreach_param_username" class="form-input outreach-dynamic-param" value="Aaryan" placeholder="Enter agent name..." style="width: 100%; border: 1px solid #CBD5E1; border-radius: 8px; padding: 6px 10px; font-size: 13px;" />
    `;
    container.appendChild(div1);

    const div2 = document.createElement("div");
    div2.className = "field";
    div2.style.marginBottom = "4px";
    div2.innerHTML = `
      <label for="outreach_param_contact" style="font-size: 12px; font-weight: 500; color: #475569; display: block; margin-bottom: 2px;">
        Contact Person / Phone <span style="font-size: 10px; color: #94A3B8;">({{user_name}})</span>
      </label>
      <input type="text" id="outreach_param_contact" class="form-input outreach-dynamic-param" value="Aaryan" placeholder="Enter contact info..." style="width: 100%; border: 1px solid #CBD5E1; border-radius: 8px; padding: 6px 10px; font-size: 13px;" />
    `;
    container.appendChild(div2);
    return;
  }
  const tpl = (cachedTemplates || []).find(t => t.name === selectedName);
  if (!tpl) return;

  const bodyText = tpl.body_text || "";
  const mappings = tpl.param_mappings || {};
  const tokens = [];

  const bMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
  bMatches.forEach((tok, idx) => {
    if (idx > 0) {
      const label = (mappings.body && mappings.body[idx]) 
        ? mappings.body[idx].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) 
        : `Parameter ${idx + 1}`;
      tokens.push({ token: tok, index: idx + 1, label, id: `outreach_param_${idx + 1}` });
    }
  });

  if (tokens.length > 0) {
    const title = document.createElement("div");
    title.style.fontSize = "12px";
    title.style.fontWeight = "600";
    title.style.color = "#0F172A";
    title.style.marginBottom = "4px";
    title.textContent = "Template Variables";
    container.appendChild(title);
  }

  tokens.forEach(item => {
    const div = document.createElement("div");
    div.className = "field";
    div.style.marginBottom = "4px";
    div.innerHTML = `
      <label for="${item.id}" style="font-size: 12px; font-weight: 500; color: #475569; display: block; margin-bottom: 2px;">
        ${escapeHtml(item.label)} <span style="font-size: 10px; color: #94A3B8;">(${item.token})</span>
      </label>
      <input type="text" id="${item.id}" class="form-input outreach-dynamic-param" data-param-index="${item.index}" placeholder="Enter ${escapeHtml(item.label.toLowerCase())}..." style="width: 100%; border: 1px solid #CBD5E1; border-radius: 8px; padding: 6px 10px; font-size: 13px;" />
    `;
    container.appendChild(div);
  });
}

const outreachTemplateSelectEl = el("outreachTemplateSelect");
if (outreachTemplateSelectEl) {
  outreachTemplateSelectEl.addEventListener("change", renderOutreachDynamicParams);
}

const closeModalBtn = el("closeModal");
if (closeModalBtn) closeModalBtn.addEventListener("click", () => { if (el("modalBackdrop")) el("modalBackdrop").hidden = true; });

const cancelAddBtn = el("cancelAdd");
if (cancelAddBtn) cancelAddBtn.addEventListener("click", () => { if (el("modalBackdrop")) el("modalBackdrop").hidden = true; });

const cpInput = el("contactPerson");
if (cpInput) {
  cpInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-Z\s.\-]/g, "");
  });
}

// ==========================================
// Scheduling Popover Panel Engine
// ==========================================
let wizardScheduleState = null;
let bulkScheduleState = null;

function formatScheduleChipText(isoDateStr, recurrence) {
  const d = new Date(isoDateStr);
  const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const rec = (recurrence && recurrence !== 'one_off') ? ` (${recurrence.charAt(0).toUpperCase() + recurrence.slice(1)})` : '';
  return `${dateStr}, ${timeStr}${rec}`;
}

function openWizardSchedulePopup() {
  const popup = el("wizardSchedulePopup");
  if (!popup) return;
  const isHidden = popup.hidden;
  if (isHidden) {
    const dtInput = el("scheduleDatetime");
    if (dtInput) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      dtInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      if (!dtInput.value) {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        dtInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    const errBox = el("wizardScheduleError");
    if (errBox) errBox.hidden = true;
    popup.hidden = false;
  } else {
    popup.hidden = true;
  }
}

function closeWizardSchedulePopup() {
  const popup = el("wizardSchedulePopup");
  if (popup) popup.hidden = true;
}

function setWizardSchedule() {
  const dtInput = el("scheduleDatetime");
  const errBox = el("wizardScheduleError");
  if (errBox) errBox.hidden = true;

  const dtVal = dtInput ? dtInput.value : "";
  if (!dtVal) {
    if (errBox) {
      errBox.textContent = "Please select a date and time.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  const schedDate = new Date(dtVal);
  if (isNaN(schedDate.getTime())) {
    if (errBox) {
      errBox.textContent = "Please enter a valid date and time.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  if (schedDate.getTime() <= Date.now()) {
    if (errBox) {
      errBox.textContent = "Date and time must be in the future.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  const recSelect = el("scheduleRecurrence");
  const recurrenceVal = recSelect ? recSelect.value : "one_off";
  let userTz = "Asia/Kolkata";
  try {
    userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch (_) {}

  const isRecurring = (recurrenceVal && recurrenceVal !== 'one_off');
  wizardScheduleState = {
    scheduledFor: dtVal,
    scheduleType: isRecurring ? 'recurring' : 'one_off',
    timezone: userTz
  };
  if (isRecurring) {
    wizardScheduleState.recurrenceInterval = recurrenceVal;
  }
  wizardState.schedule = wizardScheduleState;

  const chip = el("wizardScheduleChip");
  const chipText = el("wizardScheduleChipText");
  if (chipText) chipText.textContent = formatScheduleChipText(dtVal, recurrenceVal);
  if (chip) chip.hidden = false;

  const clockBtn = el("btnOpenSchedulePopup");
  if (clockBtn) clockBtn.classList.add("active");

  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const continueBtn = el("btnDetailsContinue");
  if (persona === 'direct_outreach' && continueBtn) {
    continueBtn.textContent = "Schedule Message →";
  }

  closeWizardSchedulePopup();
}

function clearWizardSchedule() {
  wizardScheduleState = null;
  wizardState.schedule = null;

  const chip = el("wizardScheduleChip");
  if (chip) chip.hidden = true;

  const clockBtn = el("btnOpenSchedulePopup");
  if (clockBtn) clockBtn.classList.remove("active");

  const dtInput = el("scheduleDatetime");
  if (dtInput) dtInput.value = "";
  const recSelect = el("scheduleRecurrence");
  if (recSelect) recSelect.value = "one_off";

  const errBox = el("wizardScheduleError");
  if (errBox) errBox.hidden = true;

  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const continueBtn = el("btnDetailsContinue");
  if (persona === 'direct_outreach' && continueBtn) {
    continueBtn.textContent = "Send Message →";
  }
}

function openBulkSchedulePopup() {
  const popup = el("bulkSchedulePopup");
  if (!popup) return;
  const isHidden = popup.hidden;
  if (isHidden) {
    const dtInput = el("bulkScheduleDatetime");
    if (dtInput) {
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      dtInput.min = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      if (!dtInput.value) {
        const d = new Date(Date.now() + 60 * 60 * 1000);
        d.setMinutes(Math.ceil(d.getMinutes() / 5) * 5, 0, 0);
        dtInput.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    }
    const errBox = el("bulkScheduleError");
    if (errBox) errBox.hidden = true;
    popup.hidden = false;
  } else {
    popup.hidden = true;
  }
}

function closeBulkSchedulePopup() {
  const popup = el("bulkSchedulePopup");
  if (popup) popup.hidden = true;
}

function setBulkSchedule() {
  const dtInput = el("bulkScheduleDatetime");
  const errBox = el("bulkScheduleError");
  if (errBox) errBox.hidden = true;

  const dtVal = dtInput ? dtInput.value : "";
  if (!dtVal) {
    if (errBox) {
      errBox.textContent = "Please select a date and time.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  const schedDate = new Date(dtVal);
  if (isNaN(schedDate.getTime())) {
    if (errBox) {
      errBox.textContent = "Please enter a valid date and time.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  if (schedDate.getTime() <= Date.now()) {
    if (errBox) {
      errBox.textContent = "Date and time must be in the future.";
      errBox.hidden = false;
    }
    if (dtInput) dtInput.focus();
    return;
  }

  const recSelect = el("bulkScheduleRecurrence");
  const recurrenceVal = recSelect ? recSelect.value : "one_off";
  let userTz = "Asia/Kolkata";
  try {
    userTz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
  } catch (_) {}

  const isRecurring = (recurrenceVal && recurrenceVal !== 'one_off');
  bulkScheduleState = {
    scheduledFor: dtVal,
    scheduleType: isRecurring ? 'recurring' : 'one_off',
    timezone: userTz
  };
  if (isRecurring) {
    bulkScheduleState.recurrenceInterval = recurrenceVal;
  }

  const chip = el("bulkScheduleChip");
  const chipText = el("bulkScheduleChipText");
  if (chipText) chipText.textContent = formatScheduleChipText(dtVal, recurrenceVal);
  if (chip) chip.hidden = false;

  const clockBtn = el("btnBulkOpenSchedule");
  if (clockBtn) clockBtn.classList.add("active");

  updateBulkSubmitButtonLabel();
  closeBulkSchedulePopup();
}

function clearBulkSchedule() {
  bulkScheduleState = null;

  const chip = el("bulkScheduleChip");
  if (chip) chip.hidden = true;

  const clockBtn = el("btnBulkOpenSchedule");
  if (clockBtn) clockBtn.classList.remove("active");

  const dtInput = el("bulkScheduleDatetime");
  if (dtInput) dtInput.value = "";
  const recSelect = el("bulkScheduleRecurrence");
  if (recSelect) recSelect.value = "one_off";

  const errBox = el("bulkScheduleError");
  if (errBox) errBox.hidden = true;

  updateBulkSubmitButtonLabel();
}

function updateBulkSubmitButtonLabel() {
  const submitBtn = el("btnExecuteBulkImport");
  if (!submitBtn) return;
  const validCount = (Array.isArray(parsedBulkClients) ? parsedBulkClients : []).filter(r => r.isValid).length;
  if (submitBtn.disabled && validCount === 0) return;

  if (bulkScheduleState) {
    submitBtn.textContent = `Schedule Outreach for ${validCount} Client${validCount === 1 ? '' : 's'}`;
  } else {
    submitBtn.textContent = `Import ${validCount} Client${validCount === 1 ? '' : 's'}`;
  }
}

const btnOpenSchedulePopup = el("btnOpenSchedulePopup");
if (btnOpenSchedulePopup) btnOpenSchedulePopup.addEventListener("click", openWizardSchedulePopup);

const btnCloseWizardSchedulePopup = el("btnCloseWizardSchedulePopup");
if (btnCloseWizardSchedulePopup) btnCloseWizardSchedulePopup.addEventListener("click", closeWizardSchedulePopup);

const btnCancelWizardSchedule = el("btnCancelWizardSchedule");
if (btnCancelWizardSchedule) btnCancelWizardSchedule.addEventListener("click", closeWizardSchedulePopup);

const btnSetWizardSchedule = el("btnSetWizardSchedule");
if (btnSetWizardSchedule) btnSetWizardSchedule.addEventListener("click", setWizardSchedule);

const btnClearWizardSchedule = el("btnClearWizardSchedule");
if (btnClearWizardSchedule) btnClearWizardSchedule.addEventListener("click", clearWizardSchedule);

const btnBulkOpenSchedule = el("btnBulkOpenSchedule");
if (btnBulkOpenSchedule) btnBulkOpenSchedule.addEventListener("click", openBulkSchedulePopup);

const btnCloseBulkSchedulePopup = el("btnCloseBulkSchedulePopup");
if (btnCloseBulkSchedulePopup) btnCloseBulkSchedulePopup.addEventListener("click", closeBulkSchedulePopup);

const btnCancelBulkSchedule = el("btnCancelBulkSchedule");
if (btnCancelBulkSchedule) btnCancelBulkSchedule.addEventListener("click", closeBulkSchedulePopup);

const btnSetBulkSchedule = el("btnSetBulkSchedule");
if (btnSetBulkSchedule) btnSetBulkSchedule.addEventListener("click", setBulkSchedule);

const btnBulkClearSchedule = el("btnBulkClearSchedule");
if (btnBulkClearSchedule) btnBulkClearSchedule.addEventListener("click", clearBulkSchedule);

const bulkSendWhatsAppCheckEl = el("bulkSendWhatsAppCheck");
if (bulkSendWhatsAppCheckEl) {
  bulkSendWhatsAppCheckEl.addEventListener("change", (e) => {
    const isChecked = e.target.checked;
    const clockBtn = el("btnBulkOpenSchedule");
    const chip = el("bulkScheduleChip");
    const popup = el("bulkSchedulePopup");
    if (clockBtn) clockBtn.style.display = isChecked ? "inline-flex" : "none";
    if (chip && !isChecked) chip.hidden = true;
    if (popup && !isChecked) popup.hidden = true;
    if (!isChecked) {
      clearBulkSchedule();
    }
  });
}

// Contact Duplicate Check Helpers
async function checkContactDuplicate(phone, loanProduct) {
  try {
    const res = await authFetch("/api/contacts/check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, loanProduct })
    });
    if (!res.ok) return { exists: false };
    return await res.json();
  } catch (_) {
    return { exists: false };
  }
}

function promptDuplicateContactConfirm({ contact, enteredName, loanProduct, miniTargetsCount, onConfirm, onCancel }) {
  const modal = el("duplicateConfirmModalBackdrop");
  if (!modal) {
    onConfirm();
    return;
  }

  const nameEl = el("dupExistingName");
  const phoneEl = el("dupExistingPhone");
  const diffNotice = el("dupNameDiffNotice");
  const enteredNameEl = el("dupEnteredName");
  const countEl = el("dupTargetCount");
  const qEl = el("dupConfirmQuestion");

  if (nameEl) nameEl.textContent = contact.contactPerson;
  if (phoneEl) phoneEl.textContent = contact.phone ? `+${contact.phone}` : "";
  if (countEl) countEl.textContent = miniTargetsCount || 0;

  if (enteredName && enteredName.trim().toLowerCase() !== contact.contactPerson.trim().toLowerCase()) {
    if (diffNotice) diffNotice.style.display = "block";
    if (enteredNameEl) enteredNameEl.textContent = enteredName;
  } else {
    if (diffNotice) diffNotice.style.display = "none";
  }

  if (qEl) {
    qEl.textContent = `This contact already has ${miniTargetsCount} Mini Target(s). Add new Mini Target "${loanProduct || 'Target'}" under ${contact.contactPerson}?`;
  }

  const cancelBtn = el("btnCancelDuplicateConfirm");
  const proceedBtn = el("btnProceedDuplicateConfirm");

  const cleanup = () => {
    modal.hidden = true;
    cancelBtn.onclick = null;
    proceedBtn.onclick = null;
  };

  cancelBtn.onclick = () => {
    cleanup();
    if (onCancel) onCancel();
  };

  proceedBtn.onclick = () => {
    cleanup();
    if (onConfirm) onConfirm();
  };

  modal.hidden = false;
}

// Screen 1 Continue Handler
const btnDetailsContinue = el("btnDetailsContinue");
if (btnDetailsContinue) {
  btnDetailsContinue.addEventListener("click", async () => {
    if (el("modalErrorStep1")) el("modalErrorStep1").hidden = true;
    if (el("phone")) el("phone").classList.remove("input-error");
    if (el("contactPerson")) el("contactPerson").classList.remove("input-error");
    if (el("amountRequired")) el("amountRequired").classList.remove("input-error");

    const contactPersonInput = el("contactPerson");
    const phoneInput = el("phone");
    const amountInput = el("amountRequired");

    const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
    const contactPerson = contactPersonInput ? contactPersonInput.value.trim() : "";
    if (!contactPerson) {
      if (contactPersonInput) contactPersonInput.classList.add("input-error");
      const errMsg = persona === 'direct_outreach' ? "Please enter the target's full name." : (persona === 'ca' ? "Please enter the client's full name." : "Please enter the borrower's full name.");
      showActionableError(errMsg, "modalErrorStep1");
      if (contactPersonInput) contactPersonInput.focus();
      return;
    }
    if (!/^[a-zA-Z\s.\-]+$/.test(contactPerson)) {
      if (contactPersonInput) contactPersonInput.classList.add("input-error");
      showActionableError("Please enter a valid name using letters and spaces only.", "modalErrorStep1");
      if (contactPersonInput) contactPersonInput.focus();
      return;
    }

    const rawPhone = phoneInput ? phoneInput.value.trim() : "";
    if (!/^\d{10}$/.test(rawPhone)) {
      if (phoneInput) phoneInput.classList.add("input-error");
      showActionableError("Please enter a valid 10-digit mobile number.", "modalErrorStep1");
      if (phoneInput) phoneInput.focus();
      return;
    }

    // Direct Outreach Mode: Validate template, collect dynamic parameters, and Submit Immediately
    if (persona === 'direct_outreach') {
      const templateSelect = el("outreachTemplateSelect");
      const selectedTemplate = templateSelect ? templateSelect.value : "";
      if (!selectedTemplate) {
        showActionableError("Please select a WhatsApp message template from the dropdown list.", "modalErrorStep1");
        if (templateSelect) templateSelect.focus();
        return;
      }

      // If delivery is scheduled via popover, attach schedule
      const schedulePayload = wizardScheduleState;

      // Pre-check Contact duplicate state
      const checkData = await checkContactDuplicate(rawPhone, selectedTemplate);
      if (checkData.exists && checkData.isBlocked) {
        showActionableError(checkData.blockReason || "An active Mini Target for this template already exists under this contact.", "modalErrorStep1");
        return;
      }

      const executeDirectOutreach = async () => {
        const submitBtn = el("btnDetailsContinue");
        if (submitBtn) submitBtn.disabled = true;

        const dynamicInputs = Array.from(document.querySelectorAll(".outreach-dynamic-param"));
        const dynamicParams = [contactPerson, ...dynamicInputs.map(i => i.value.trim())];

        try {
          const reqBody = {
            contactPerson,
            phone: rawPhone,
            loanProduct: selectedTemplate,
            templateName: selectedTemplate,
            templateParams: dynamicParams,
            amountRequired: null,
            noDocsRequired: true,
            requiredDocIds: []
          };
          if (schedulePayload) {
            reqBody.schedule = schedulePayload;
          }

          const res = await authFetch("/api/cases", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(reqBody)
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Failed to dispatch direct message.");

          if (el("modalBackdrop")) el("modalBackdrop").hidden = true;
          if (typeof UI !== 'undefined' && UI.toast) {
            if (data.scheduled) {
              UI.toast(`Direct message scheduled for ${contactPerson}!`, "success");
            } else {
              UI.toast(`Direct message dispatched to ${contactPerson}!`, "success");
            }
          }
          await load();
        } catch (err) {
          showActionableError(`Dispatch Error: ${err.message}`, "modalErrorStep1");
        } finally {
          if (submitBtn) submitBtn.disabled = false;
        }
      };

      if (checkData.exists) {
        promptDuplicateContactConfirm({
          contact: checkData.contact,
          enteredName: contactPerson,
          loanProduct: selectedTemplate,
          miniTargetsCount: checkData.miniTargetsCount,
          onConfirm: executeDirectOutreach
        });
      } else {
        await executeDirectOutreach();
      }
      return;
    }

    let selectedProduct = el("loanProductSelect") ? el("loanProductSelect").value : "";
    if (!selectedProduct) {
      const errMsg = (persona === 'ca' ? "Please select a category from the dropdown list." : "Please select a loan type from the dropdown list.");
      showActionableError(errMsg, "modalErrorStep1");
      if (el("loanProductSelect")) el("loanProductSelect").focus();
      return;
    }

    if (selectedProduct === "__custom__") {
      const customLabel = el("customProductInput").value.trim();
      if (!customLabel) {
        const errMsg = persona === 'ca' ? "Please enter a name for your custom category." : "Please enter a name for your custom loan type.";
        showActionableError(errMsg, "modalErrorStep1");
        el("customProductInput").focus();
        return;
      }
      
      try {
        const prodRes = await authFetch("/api/loan-products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: customLabel })
        });
        const prodData = await prodRes.json();
        if (!prodRes.ok) throw new Error(prodData.error || (persona === 'ca' ? "Could not save custom category." : "Could not save custom collection product."));
        selectedProduct = customLabel;
      } catch (prodErr) {
        showActionableError(`Failed to save new category: ${prodErr.message}`, "modalErrorStep1");
        return;
      }
    }

    // Pre-check Contact duplicate state
    const checkData = await checkContactDuplicate(rawPhone, selectedProduct);
    if (checkData.exists && checkData.isBlocked) {
      showActionableError(checkData.blockReason || `An active Mini Target for "${selectedProduct}" already exists under this contact.`, "modalErrorStep1");
      return;
    }

    let amountRequired = 0;
    if (persona === 'loan_agent') {
      const rawAmount = el("amountRequired").value.trim();
      if (!rawAmount) {
        showActionableError("Please enter the Amount Required in Lacs / ₹ Lakhs.", "modalErrorStep1");
        el("amountRequired").focus();
        return;
      }
      amountRequired = parseFloat(rawAmount);
      if (isNaN(amountRequired) || amountRequired <= 0) {
        showActionableError("Please enter a valid positive number for Amount Required in Lacs (e.g. 25).", "modalErrorStep1");
        el("amountRequired").focus();
        return;
      }
    } else {
      const rawAmount = el("amountRequired") ? el("amountRequired").value.trim() : "";
      amountRequired = (rawAmount && !isNaN(parseFloat(rawAmount)) && parseFloat(rawAmount) > 0) ? parseFloat(rawAmount) : null;
    }

    // If delivery is scheduled via popover, attach schedule
    const schedulePayload = wizardScheduleState;

    const proceedToDocsScreen = () => {
      // Save to State Machine
      wizardState.customer = { contactPerson, phone: rawPhone };
      wizardState.loan = { product: selectedProduct, amountRequired };
      wizardState.schedule = schedulePayload;

      renderScreen2DocChecklists();
      setWizardScreen('documents');
    };

    if (checkData.exists) {
      promptDuplicateContactConfirm({
        contact: checkData.contact,
        enteredName: contactPerson,
        loanProduct: selectedProduct,
        miniTargetsCount: checkData.miniTargetsCount,
        onConfirm: proceedToDocsScreen
      });
    } else {
      proceedToDocsScreen();
    }
  });
}

// Screen 2 Back Handler
const btnDocsBack = el("btnDocsBack");
if (btnDocsBack) btnDocsBack.addEventListener("click", () => setWizardScreen('details'));

// Screen 2 Create Case Handler
const btnDocsCreate = el("btnDocsCreate");
if (btnDocsCreate) {
  btnDocsCreate.addEventListener("click", async () => {
    if (el("modalErrorStep2")) el("modalErrorStep2").hidden = true;
    const submitBtn = el("btnDocsCreate");

    const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
    const selectedDocs = Array.from(document.querySelectorAll("input[data-doc]:checked")).map(cb => cb.value);
    if (selectedDocs.length === 0) {
      const errMsg = persona === 'ca' ? "Please select at least one document requirement for this client intake." : "Please select at least one document requirement for this loan case.";
      showActionableError(errMsg, "modalErrorStep2");
      return;
    }

    wizardState.documents.selectedIds = selectedDocs;
    
    // Store original button content & show immediate spinner loading state
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.style.opacity = "0.7";
    submitBtn.style.cursor = "not-allowed";
    const isSched = !!wizardState.schedule;
    const spinnerText = isSched
      ? (persona === 'ca' ? "Scheduling Request..." : "Scheduling Loan Case...")
      : (persona === 'ca' ? "Creating Request..." : "Creating Loan Case...");
    submitBtn.innerHTML = `
      <span class="upload-progress-ring" style="width: 14px; height: 14px; border-width: 2px; display: inline-block; vertical-align: middle; margin-right: 0.5rem; border-color: rgba(255,255,255,0.3); border-top-color: #ffffff;"></span>
      ${spinnerText}
    `;

    try {
      const postBody = {
        contactPerson: wizardState.customer.contactPerson,
        phone: wizardState.customer.phone,
        loanProduct: wizardState.loan.product,
        amountRequired: wizardState.loan.amountRequired,
        requiredDocIds: wizardState.documents.selectedIds
      };
      if (wizardState.schedule) {
        postBody.schedule = wizardState.schedule;
      }

      const res = await authFetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody)
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (persona === 'ca' ? "Failed to create client intake." : "Failed to create collection."));

      wizardState.generatedCase = { id: data.caseId, token: data.token };

      if (typeof UI !== 'undefined' && UI.toast) {
        if (data.scheduled) {
          UI.toast(persona === 'ca' ? "Client intake scheduled!" : "Loan case scheduled!", "success");
        }
      }

      // Populate Screen 3 Success UI
      const nameEl = el("successCustomerName");
      if (nameEl) nameEl.textContent = wizardState.customer.contactPerson;

      const token = data.token || '';
      const shareUrl = `${window.location.origin}/upload.html?t=${token}`;

      const waBtn = el("btnShareWhatsApp");
      if (waBtn) {
        const msgPrefix = persona === 'ca' ? `Hello ${wizardState.customer.contactPerson}, please upload your documents for ${wizardState.loan.product} here:` : `Hello ${wizardState.customer.contactPerson}, please upload your loan documents for ${wizardState.loan.product} here:`;
        const waText = encodeURIComponent(`${msgPrefix} ${shareUrl}`);
        waBtn.href = `https://wa.me/91${wizardState.customer.phone}?text=${waText}`;
      }

      const copyBtn = el("btnCopyLink");
      if (copyBtn) {
        copyBtn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(shareUrl);
            if (typeof UI !== 'undefined' && UI.toast) {
              UI.toast("Upload link copied to clipboard!", "success");
            } else {
              alert("Upload link copied!");
            }
          } catch(e) {
            console.error(e);
          }
        };
      }

      await load();
      setWizardScreen('success');
    } catch (err) {
      showActionableError(err.message, "modalErrorStep2");
    } finally {
      submitBtn.disabled = false;
      submitBtn.style.opacity = "1";
      submitBtn.style.cursor = "pointer";
      submitBtn.innerHTML = originalText;
    }
  });
}

// Screen 3 Success Navigation Handlers
const btnSuccessGoToCase = el("btnSuccessGoToCase");
if (btnSuccessGoToCase) {
  btnSuccessGoToCase.addEventListener("click", () => {
    if (el("modalBackdrop")) el("modalBackdrop").hidden = true;
    if (wizardState.generatedCase && wizardState.generatedCase.id) {
      window.location.href = `/case.html?id=${wizardState.generatedCase.id}`;
    }
  });
}

const btnSuccessCreateAnother = el("btnSuccessCreateAnother");
if (btnSuccessCreateAnother) {
  btnSuccessCreateAnother.addEventListener("click", () => {
    if (el("detailsForm")) el("detailsForm").reset();
    if (el("customProductGroup")) el("customProductGroup").hidden = true;
    if (el("liveDocPreviewContainer")) el("liveDocPreviewContainer").hidden = true;
    if (el("modalErrorStep1")) el("modalErrorStep1").hidden = true;
    if (el("modalErrorStep2")) el("modalErrorStep2").hidden = true;
    setWizardScreen('details');
  });
}

function setupSidebarToggle() {
  const sidebar = el("appSidebar");
  const toggleBtn = el("sidebarToggle");
  if (!sidebar || !toggleBtn) return;

  const isCollapsed = localStorage.getItem("sidebar_collapsed") === "true";
  if (isCollapsed) {
    sidebar.classList.add("collapsed");
    toggleBtn.textContent = "▶";
  }

  toggleBtn.onclick = () => {
    const collapsed = sidebar.classList.toggle("collapsed");
    toggleBtn.textContent = collapsed ? "▶" : "◀";
    localStorage.setItem("sidebar_collapsed", collapsed);
  };

  const newCaseBtn = el("sidebarNewCase");
  if (newCaseBtn) {
    newCaseBtn.onclick = (e) => {
      e.preventDefault();
      const openAdd = el("openAdd");
      if (openAdd) openAdd.click();
    };
  }
}

function getUserFromToken() {
  const tokenHeader = localStorage.getItem('collectrr_auth');
  const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!tokenHeader && isDev) return { username: 'DevAgent', role: 'admin' };
  if (!tokenHeader) return null;
  try {
    const rawToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
    const parts = rawToken.split('.');
    if (parts.length !== 3) return isDev ? { username: 'DevAgent', role: 'admin' } : null;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson);
  } catch (e) {
    return isDev ? { username: 'DevAgent', role: 'admin' } : null;
  }
}

function updateUserProfileUI() {
  const user = getUserFromToken();
  if (!user) return;

  const username = user.username || 'User';
  const role = user.role ? (user.role.charAt(0).toUpperCase() + user.role.slice(1)) : 'Agent';

  const nameParts = username.trim().split(/\s+/);
  let initials = "";
  if (nameParts.length >= 2) {
    initials = (nameParts[0][0] + nameParts[1][0]).toUpperCase();
  } else if (nameParts[0].length >= 2) {
    initials = nameParts[0].slice(0, 2).toUpperCase();
  } else {
    initials = nameParts[0].toUpperCase();
  }

  const avatarEl = document.getElementById("userAvatar") || document.querySelector('.sidebar-user .user-avatar');
  const nameEl = document.getElementById("userName") || document.querySelectorAll('.sidebar-user .user-info div')[0];
  const roleEl = document.getElementById("userRole") || document.querySelectorAll('.sidebar-user .user-info div')[1];

  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl) nameEl.textContent = username;
  if (roleEl) roleEl.textContent = role;

  const isAdmin = user && (user.role === 'admin' || user.role === 'Admin');

  const navAnalytics = document.getElementById("navAnalytics");
  if (navAnalytics) {
    navAnalytics.style.display = isAdmin ? '' : 'none';
  }

  const navObservability = document.getElementById("navObservability");
  if (navObservability) {
    navObservability.style.display = isAdmin ? '' : 'none';
  }

  const btnDocMapping = el("btnOpenDocMappingModal");
  if (btnDocMapping) {
    btnDocMapping.style.display = isAdmin ? '' : 'none';
  }

  const btnTemplate = el("btnOpenTemplateModal");
  if (btnTemplate) {
    btnTemplate.style.display = isAdmin ? '' : 'none';
  }

  const isDevHost = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const outreachToggleBtn = document.getElementById("personaToggleOutreach");
  if (outreachToggleBtn) {
    outreachToggleBtn.style.display = (isAdmin || isDevHost) ? '' : 'none';
  }

  if (!isAdmin && !isDevHost && typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach') {
    if (typeof window.setVariantKey === 'function') window.setVariantKey('ca');
  }

  const userContainers = document.querySelectorAll('.sidebar-user');
  userContainers.forEach(container => {
    container.style.cursor = 'pointer';
    container.title = 'Click to log out';
    container.onclick = async () => {
      const ok = await UI.confirm({
        title: "Confirm Logout",
        message: `Log out from ${username}?`,
        confirmText: "Log Out",
        isDanger: true
      });
      if (ok) {
        localStorage.removeItem('collectrr_auth');
        window.location.href = '/login.html';
      }
    };
  });
}

// Initial load
setupSidebarToggle();
updateUserProfileUI();
load();

function renderMappingConfiguratorMatrix() {
  const headerRow = el("mappingMatrixHeaderRow");
  const tbody = el("mappingMatrixTableBody");
  if (!headerRow || !tbody) return;

  const persona = typeof window.getVariantKey === 'function' ? window.getVariantKey() : 'ca';
  const categoryTitle = persona === 'ca' ? "Filing" : "Loan Product";
  headerRow.innerHTML = `<th>${categoryTitle}</th>`;

  const activeCatalog = (persona === 'ca')
    ? documentCatalog.filter(doc => !['gst_returns', 'quotation', 'property_docs', 'invoices'].includes(doc.id))
    : documentCatalog;

  activeCatalog.forEach(doc => {
    const th = document.createElement("th");
    th.style.textAlign = "center";
    th.textContent = doc.label;
    headerRow.appendChild(th);
  });

  tbody.innerHTML = "";
  
  const products = (persona === "ca")
    ? [
        "GST — Monthly (GSTR-1 & 3B)",
        "GST — Annual Return (GSTR-9 & 9C)",
        "GST — Registration Intake",
        "ITR — Salaried (ITR-1 / 2)",
        "ITR — Business (ITR-3 / 4)",
        "ITR — Capital Gains & NRI",
        "ITR — Tax Audit (Form 3CD)"
      ]
    : ((loanProductsList && loanProductsList.length > 0)
      ? loanProductsList.map(p => p.label)
      : ["Home Loan Pack", "LAP (Property Loan)", "Business Loan", "Personal Loan Pack"]);

  products.forEach(pLabel => {
    const tr = document.createElement("tr");
    const tdProd = document.createElement("td");
    tdProd.innerHTML = `<strong>${escapeHtml(pLabel)}</strong>`;
    tr.appendChild(tdProd);

    const activeDocIds = new Set(loanProductMappings[pLabel] || []);

    documentCatalog.forEach(doc => {
      const tdCheck = document.createElement("td");
      tdCheck.className = "matrix-cell-check";
      const checked = activeDocIds.has(doc.id);
      tdCheck.innerHTML = `<input type="checkbox" data-matrix-product="${escapeHtml(pLabel)}" data-matrix-doc="${doc.id}" ${checked ? 'checked' : ''} />`;
      tr.appendChild(tdCheck);
    });

    tbody.appendChild(tr);
  });
}

const btnOpenDocMappingModal = el("btnOpenDocMappingModal");
if (btnOpenDocMappingModal) {
  btnOpenDocMappingModal.addEventListener("click", () => {
    renderMappingConfiguratorMatrix();
    if (el("docMappingModalBackdrop")) el("docMappingModalBackdrop").hidden = false;
  });
}

const closeDocMappingModal = el("closeDocMappingModal");
if (closeDocMappingModal) closeDocMappingModal.addEventListener("click", () => { if (el("docMappingModalBackdrop")) el("docMappingModalBackdrop").hidden = true; });

const cancelDocMappingModal = el("cancelDocMappingModal");
if (cancelDocMappingModal) cancelDocMappingModal.addEventListener("click", () => { if (el("docMappingModalBackdrop")) el("docMappingModalBackdrop").hidden = true; });

const btnSaveDocMappings = el("btnSaveDocMappings");
if (btnSaveDocMappings) {
  btnSaveDocMappings.addEventListener("click", async () => {
    const submitBtn = el("btnSaveDocMappings");
    const errBox = el("mappingConfigError");
    if (errBox) errBox.hidden = true;

    const newMappings = {};
    document.querySelectorAll("input[data-matrix-product]").forEach(cb => {
      const pLabel = cb.getAttribute("data-matrix-product");
      const docId = cb.getAttribute("data-matrix-doc");
      if (!newMappings[pLabel]) newMappings[pLabel] = [];
      if (cb.checked) {
        newMappings[pLabel].push(docId);
      }
    });

    submitBtn.disabled = true;
    try {
      const res = await authFetch("/api/admin/loan-product-mappings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mappings: newMappings })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save mapping rules.");

      loanProductMappings = newMappings;
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast("Document collection rules updated!", "success");
      }
      if (el("docMappingModalBackdrop")) el("docMappingModalBackdrop").hidden = true;
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}

// ==========================================
// WhatsApp Message Templates UI Engine
// ==========================================

let activeTemplateTab = "list";
let cachedTemplates = [];
let currentEditingTemplateId = null;

function openTemplateModal() {
  const backdrop = el("templateModalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = false;
  currentEditingTemplateId = null;
  switchTemplateTab("list");
  loadTemplatesList();
}

function closeTemplateModal() {
  const backdrop = el("templateModalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
  currentEditingTemplateId = null;
}

function switchTemplateTab(tab) {
  activeTemplateTab = tab;
  const tabList = el("tabTplList");
  const tabCreate = el("tabTplCreate");
  const listView = el("tplListView");
  const createView = el("tplCreateView");
  const saveBtn = el("btnSaveTemplate");
  const nameInput = el("tplNameInput");

  if (tab === "list") {
    currentEditingTemplateId = null;
    if (tabList) tabList.classList.add("active");
    if (tabCreate) tabCreate.classList.remove("active");
    if (listView) listView.hidden = false;
    if (createView) createView.hidden = true;
    if (saveBtn) saveBtn.style.display = "none";
    if (nameInput) nameInput.disabled = false;
    loadTemplatesList();
  } else {
    if (tabList) tabList.classList.remove("active");
    if (tabCreate) tabCreate.classList.add("active");
    if (listView) listView.hidden = true;
    if (createView) createView.hidden = false;
    if (saveBtn) {
      saveBtn.style.display = "";
      saveBtn.textContent = currentEditingTemplateId ? "Update Template" : "Save Template";
    }
    if (nameInput) {
      nameInput.disabled = Boolean(currentEditingTemplateId);
    }
    updateTemplateLivePreview();
  }
}

async function fetchTemplates() {
  try {
    const res = await authFetch("/api/templates");
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.templates) {
      cachedTemplates = data.templates;
      return cachedTemplates;
    }
  } catch (e) {
    console.warn("Failed fetching templates", e);
  }
  return [];
}

async function loadTemplatesList() {
  const container = el("tplListContainer");
  const loading = el("tplListLoading");
  if (loading) loading.hidden = false;
  if (container) container.hidden = true;

  try {
    const tpls = await fetchTemplates();
    renderTemplatesList(tpls.length > 0 ? tpls : cachedTemplates);
  } catch (err) {
    if (loading) {
      loading.textContent = "Failed to load templates: " + err.message;
      loading.hidden = false;
    }
  }
}

function renderTemplatesList(templates) {
  const container = el("tplListContainer");
  const loading = el("tplListLoading");
  if (loading) loading.hidden = true;
  if (!container) return;

  container.innerHTML = "";
  if (!templates || templates.length === 0) {
    container.innerHTML = `<div style="text-align: center; color: #64748B; padding: 20px;">No templates found.</div>`;
    container.hidden = false;
    return;
  }

  // Deduplicate strictly by trimmed lowercase name; prioritize system templates
  const seenNames = new Set();
  const sortedTemplates = [...templates].sort((a, b) => (b.is_system ? 1 : 0) - (a.is_system ? 1 : 0));

  sortedTemplates.forEach(tpl => {
    const cleanName = (tpl.name || "").trim().toLowerCase();
    if (!cleanName || seenNames.has(cleanName) || cleanName === "do_ca" && !tpl.is_system && seenNames.has("do_ca")) {
      return;
    }
    seenNames.add(cleanName);

    const card = document.createElement("div");
    card.className = "tpl-card";

    const isSystem = Boolean(tpl.is_system);
    const badgeClass = isSystem ? "tpl-badge-system" : "tpl-badge-custom";
    const badgeText = isSystem ? "System Default" : "Custom Template";

    card.innerHTML = `
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
          <span style="font-weight: 700; font-size: 14px; color: #0F172A;">${escapeHtml(tpl.name)}</span>
          <span class="${badgeClass}">${badgeText}</span>
          <span style="background: #F1F5F9; color: #475569; font-size: 11px; font-weight: 600; padding: 2px 6px; border-radius: 4px;">🌐 ${escapeHtml(tpl.language || 'en')}</span>
          <span style="background: #F8FAFC; border: 1px solid #E2E8F0; color: #64748B; font-size: 11px; padding: 2px 6px; border-radius: 4px;">${escapeHtml(tpl.category || 'UTILITY')}</span>
        </div>
        ${tpl.header_text ? `<div style="font-weight: 700; font-size: 13px; color: #1E293B; margin-bottom: 2px;">📌 ${escapeHtml(tpl.header_text)}</div>` : ''}
        <div style="font-size: 13px; color: #334155; line-height: 1.4; margin-top: 4px; white-space: pre-wrap;">${escapeHtml(tpl.body_text || tpl.description || '')}</div>
        ${tpl.footer_text ? `<div style="font-size: 11px; color: #64748B; margin-top: 4px;">ℹ️ ${escapeHtml(tpl.footer_text)}</div>` : ''}
        ${tpl.button_type && tpl.button_type !== 'none' ? `<div style="margin-top: 6px; font-size: 12px; color: #00A884; font-weight: 600;">🔗 Button: ${escapeHtml(tpl.button_text || 'Upload Documents')} (${escapeHtml(tpl.button_type)})</div>` : ''}
      </div>
      <div style="display: flex; gap: 6px;">
        <button type="button" class="btn" style="padding: 4px 10px; font-size: 12px; border: 1px solid #CBD5E1; background: #FFFFFF; color: #0F172A;" onclick="editCustomTemplate('${escapeHtml(tpl.name)}')">
          ✏️ Edit
        </button>
        <button type="button" class="btn" style="padding: 4px 10px; font-size: 12px; color: #DC2626; border: 1px solid #FECACA; background: #FEF2F2;" onclick="deleteCustomTemplate('${escapeHtml(tpl.id || tpl.name)}')">
          Delete
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  container.hidden = false;
}

function insertTemplateToken(token) {
  const textarea = el("tplBodyInput");
  if (!textarea) return;
  const start = textarea.selectionStart || 0;
  const end = textarea.selectionEnd || 0;
  const text = textarea.value;
  textarea.value = text.substring(0, start) + token + text.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + token.length;
  updateTemplateLivePreview();
}

function updateTemplateLivePreview() {
  const headerTypeSelect = el("tplHeaderTypeSelect");
  const headerInput = el("tplHeaderInput");
  const headerGroup = el("tplHeaderGroup");
  const bodyInput = el("tplBodyInput");
  const footerInput = el("tplFooterInput");
  const buttonTypeSelect = el("tplButtonTypeSelect");
  const buttonTextInput = el("tplButtonTextInput");
  const buttonTextGroup = el("tplButtonTextGroup");

  const liveHeader = el("tplLiveHeader");
  const liveText = el("tplLivePreviewText");
  const liveFooter = el("tplLiveFooter");
  const liveBtnContainer = el("tplLiveButtonContainer");
  const liveBtnText = el("tplLiveButtonText");

  // 1. Header Handling
  const headerType = headerTypeSelect ? headerTypeSelect.value : "NONE";
  if (headerGroup) {
    headerGroup.style.display = (headerType === "TEXT") ? "" : "none";
  }
  if (liveHeader) {
    if (headerType === "TEXT" && headerInput && headerInput.value.trim()) {
      liveHeader.textContent = headerInput.value.trim().replace(/\{\{1\}\}/g, "Aryan Shah");
      liveHeader.style.display = "";
    } else {
      liveHeader.style.display = "none";
    }
  }

  // 2. Body Handling
  const rawBody = bodyInput && bodyInput.value ? bodyInput.value : "Hi {{1}}, please upload your pending documents using the secure link: {{2}}";
  const renderedBody = rawBody
    .replace(/\{\{1\}\}/g, "Aryan Shah")
    .replace(/\{\{2\}\}/g, "https://collectrr-v2.collectr.workers.dev/upload.html?t=secure_token")
    .replace(/\{\{3\}\}/g, "ITR Filing")
    .replace(/\{\{4\}\}/g, "₹5,00,000")
    .replace(/\{\{5\}\}/g, "CASE-9021");

  if (liveText) {
    liveText.textContent = renderedBody;
  }

  // 3. Footer Handling
  if (liveFooter) {
    if (footerInput && footerInput.value.trim()) {
      liveFooter.textContent = footerInput.value.trim();
      liveFooter.style.display = "";
    } else {
      liveFooter.style.display = "none";
    }
  }

  // 4. Button Handling
  const btnType = buttonTypeSelect ? buttonTypeSelect.value : "url";
  const btnLabel = buttonTextInput && buttonTextInput.value.trim() ? buttonTextInput.value.trim() : "Upload Documents";

  if (buttonTextGroup) {
    buttonTextGroup.style.display = (btnType === "none") ? "none" : "";
  }

  if (liveBtnContainer) {
    if (btnType !== "none") {
      liveBtnContainer.style.display = "";
      if (liveBtnText) {
        const icon = (btnType === "quick_reply") ? "💬" : "🔗";
        liveBtnText.innerHTML = `<span>${icon}</span> ${escapeHtml(btnLabel)}`;
      }
    } else {
      liveBtnContainer.style.display = "none";
    }
  }

  const timeEl = el("tplLivePreviewTime");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}

async function saveCustomTemplate() {
  const nameInput = el("tplNameInput");
  const categorySelect = el("tplCategorySelect");
  const langSelect = el("tplLangSelect");
  const headerTypeSelect = el("tplHeaderTypeSelect");
  const headerInput = el("tplHeaderInput");
  const bodyInput = el("tplBodyInput");
  const footerInput = el("tplFooterInput");
  const buttonTypeSelect = el("tplButtonTypeSelect");
  const buttonTextInput = el("tplButtonTextInput");
  const errBox = el("tplCreateError");
  const submitBtn = el("btnSaveTemplate");

  if (errBox) errBox.hidden = true;

  const rawName = nameInput ? nameInput.value.trim().toLowerCase() : "";
  const name = rawName.replace(/[^a-z0-9_]/g, "_");
  const category = categorySelect ? categorySelect.value : "UTILITY";
  const language = langSelect ? langSelect.value : "en";
  const headerType = headerTypeSelect ? headerTypeSelect.value : "NONE";
  const headerText = headerInput ? headerInput.value.trim() : "";
  const bodyText = bodyInput ? bodyInput.value.trim() : "";
  const footerText = footerInput ? footerInput.value.trim() : "";
  const buttonType = buttonTypeSelect ? buttonTypeSelect.value : "url";
  const buttonText = buttonTextInput ? buttonTextInput.value.trim() : "Upload Documents";

  if (!name || name.length < 2) {
    if (errBox) {
      errBox.textContent = "Please enter a valid template identifier (at least 2 lowercase letters, numbers, or underscores).";
      errBox.hidden = false;
    }
    return;
  }

  if (!language) {
    if (errBox) {
      errBox.textContent = "Please select a language code for Meta template registration.";
      errBox.hidden = false;
    }
    return;
  }

  if (!bodyText) {
    if (errBox) {
      errBox.textContent = "Please enter message body text.";
      errBox.hidden = false;
    }
    return;
  }

  // Prevent creating duplicate templates with the same name
  const collision = (cachedTemplates || []).find(t =>
    (t.name || "").toLowerCase() === name &&
    (t.id || t.name) !== currentEditingTemplateId
  );
  if (collision) {
    if (errBox) {
      errBox.textContent = `A template with the name "${name}" already exists. Template names must be unique.`;
      errBox.hidden = false;
    }
    return;
  }

  // Parse token parameters in body
  const bodyTokens = (bodyText.match(/\{\{(\d+)\}\}/g) || []).map((_, idx) => {
    if (idx === 0) return "contact_person";
    if (idx === 1) return "upload_link";
    if (idx === 2) return "loan_product";
    if (idx === 3) return "amount_required";
    return "case_id";
  });

  const paramMappings = {
    body: bodyTokens,
    header: headerType === "TEXT" && headerText.includes("{{1}}") ? ["contact_person"] : [],
    button: buttonType === "dynamic_url" ? ["raw_token"] : []
  };

  if (submitBtn) submitBtn.disabled = true;

  try {
    const isEdit = Boolean(currentEditingTemplateId);
    const res = await authFetch("/api/admin/templates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentEditingTemplateId || undefined,
        name,
        category,
        language,
        header_type: headerType,
        header_text: headerText,
        body_text: bodyText,
        footer_text: footerText,
        button_type: buttonType,
        button_text: buttonText,
        param_mappings: paramMappings
      })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to save template.");

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(isEdit ? `Template "${name}" updated successfully!` : `Template "${name}" created successfully!`, "success");
    }

    currentEditingTemplateId = null;
    if (nameInput) nameInput.value = "";
    if (bodyInput) bodyInput.value = "";
    if (headerInput) headerInput.value = "";
    if (footerInput) footerInput.value = "";
    switchTemplateTab("list");
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
}

async function deleteCustomTemplate(id) {
  const ok = await UI.confirm({
    title: "Delete Template",
    message: `Are you sure you want to delete template "${id}"?`,
    confirmText: "Delete",
    isDanger: true
  });
  if (!ok) return;

  try {
    const res = await authFetch(`/api/admin/templates/${encodeURIComponent(id)}`, {
      method: "DELETE"
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to delete template.");

    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast("Template deleted.", "success");
    }
    loadTemplatesList();
  } catch (err) {
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast("Error: " + err.message, "error");
    }
  }
}

function editCustomTemplate(name) {
  const tpl = cachedTemplates.find(t => t.name === name);
  if (!tpl) return;

  currentEditingTemplateId = tpl.id || tpl.name;

  const nameInput = el("tplNameInput");
  const categorySelect = el("tplCategorySelect");
  const langSelect = el("tplLangSelect");
  const headerTypeSelect = el("tplHeaderTypeSelect");
  const headerInput = el("tplHeaderInput");
  const bodyInput = el("tplBodyInput");
  const footerInput = el("tplFooterInput");
  const buttonTypeSelect = el("tplButtonTypeSelect");
  const buttonTextInput = el("tplButtonTextInput");

  if (nameInput) nameInput.value = tpl.name || "";
  if (categorySelect) categorySelect.value = tpl.category || "UTILITY";
  if (langSelect) langSelect.value = tpl.language || "en";
  if (headerTypeSelect) headerTypeSelect.value = tpl.header_type || "NONE";
  if (headerInput) headerInput.value = tpl.header_text || "";
  if (bodyInput) bodyInput.value = tpl.body_text || "";
  if (footerInput) footerInput.value = tpl.footer_text || "";
  if (buttonTypeSelect) buttonTypeSelect.value = tpl.button_type || "url";
  if (buttonTextInput) buttonTextInput.value = tpl.button_text || "Upload Documents";

  switchTemplateTab("create");
}

// Wire template modal trigger buttons and preview event listeners
const btnOpenTemplateModal = el("btnOpenTemplateModal");
if (btnOpenTemplateModal) {
  btnOpenTemplateModal.addEventListener("click", openTemplateModal);
}

const closeTemplateModalBtn = el("closeTemplateModal");
if (closeTemplateModalBtn) {
  closeTemplateModalBtn.addEventListener("click", closeTemplateModal);
}

const cancelTemplateModalBtn = el("cancelTemplateModal");
if (cancelTemplateModalBtn) {
  cancelTemplateModalBtn.addEventListener("click", closeTemplateModal);
}

const tplHeaderTypeSelect = el("tplHeaderTypeSelect");
if (tplHeaderTypeSelect) {
  tplHeaderTypeSelect.addEventListener("change", updateTemplateLivePreview);
}

const tplHeaderInput = el("tplHeaderInput");
if (tplHeaderInput) {
  tplHeaderInput.addEventListener("input", updateTemplateLivePreview);
}

const tplBodyInput = el("tplBodyInput");
if (tplBodyInput) {
  tplBodyInput.addEventListener("input", updateTemplateLivePreview);
}

const tplFooterInput = el("tplFooterInput");
if (tplFooterInput) {
  tplFooterInput.addEventListener("input", updateTemplateLivePreview);
}

const tplButtonTypeSelect = el("tplButtonTypeSelect");
if (tplButtonTypeSelect) {
  tplButtonTypeSelect.addEventListener("change", updateTemplateLivePreview);
}

const tplButtonTextInput = el("tplButtonTextInput");
if (tplButtonTextInput) {
  tplButtonTextInput.addEventListener("input", updateTemplateLivePreview);
}

// ==========================================
// Bulk Client List Import Engine
// ==========================================

let parsedBulkClients = [];
let lastBulkFileContent = "";

function openBulkImportModal() {
  const backdrop = el("bulkImportModalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = false;
  parsedBulkClients = [];
  lastBulkFileContent = "";
  const headerCheck = el("bulkHasHeaderCheck");
  if (headerCheck) headerCheck.checked = true;
  populateBulkTemplateDropdown();
  populateBulkCategoryDropdown();
  updateBulkSampleFormat();
  renderBulkImportPreview([]);
  const err = el("bulkImportError");
  if (err) err.hidden = true;
  const fileInput = el("bulkFileInput");
  if (fileInput) fileInput.value = "";
  clearBulkSchedule();
  const sendWhatsAppCheck = el("bulkSendWhatsAppCheck");
  const clockBtn = el("btnBulkOpenSchedule");
  if (clockBtn) clockBtn.style.display = (sendWhatsAppCheck && sendWhatsAppCheck.checked) ? "inline-flex" : "none";
}

function updateBulkSampleFormat() {
  const isDirectOutreach = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach');
  const sampleEl = el("bulkSampleFormatContent");
  const templateSelect = el("bulkTemplateSelect");
  const categoryGroup = el("bulkCategoryGroup");

  if (categoryGroup) {
    categoryGroup.style.display = isDirectOutreach ? "none" : "";
  }

  if (!sampleEl) return;

  const tplName = templateSelect ? templateSelect.value : "new_convo_1";
  const tpl = (cachedTemplates || []).find(t => t.name === tplName);

  if (isDirectOutreach) {
    const bodyText = tpl?.body_text || "";
    const bMatches = bodyText.match(/\{\{(\d+)\}\}/g) || [];
    if (bMatches.length > 1) {
      sampleEl.innerHTML = `
        <div style="color: #64748B; font-weight: 600;">Name, Phone, Param2, Param3</div>
        <div>John Doe, 9876543210, Notice_123, 24-Aug-2026</div>
        <div>Priya Patel, 9876543211, Notice_124, 25-Aug-2026</div>
      `;
    } else {
      sampleEl.innerHTML = `
        <div style="color: #64748B; font-weight: 600;">Name, Phone</div>
        <div>John Doe, 9876543210</div>
        <div>Priya Patel, 9876543211</div>
      `;
    }
  } else {
    sampleEl.innerHTML = `
      <div style="color: #64748B; font-weight: 600;">Name, Phone, Category, Amount</div>
      <div>John Doe, 9876543210, Direct Intake, 500000</div>
      <div>Priya Patel, 9876543211, ITR Filing, 250000</div>
    `;
  }
}

function closeBulkImportModal() {
  const backdrop = el("bulkImportModalBackdrop");
  if (backdrop) backdrop.hidden = true;
}

function populateBulkTemplateDropdown() {
  const select = el("bulkTemplateSelect");
  if (!select) return;
  select.innerHTML = `
    <option value="new_convo_1">new_convo_1 (Onboarding Intake)</option>
    <option value="hello_world">hello_world (Meta Default)</option>
  `;
  const seenDropdownNames = new Set(["new_convo_1", "hello_world"]);
  if (Array.isArray(cachedTemplates) && cachedTemplates.length > 0) {
    cachedTemplates.forEach(t => {
      const clean = (t.name || "").trim().toLowerCase();
      if (!seenDropdownNames.has(clean)) {
        seenDropdownNames.add(clean);
        const opt = document.createElement("option");
        opt.value = t.name;
        opt.textContent = `${t.name} (${t.category || 'Custom'})`;
        select.appendChild(opt);
      }
    });
  }
}

function populateBulkCategoryDropdown() {
  const select = el("bulkCategorySelect");
  if (!select) return;
  const isCa = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'ca');
  if (isCa) {
    select.innerHTML = `
      <option value="Direct Intake">Direct Intake</option>
      <option value="ITR Filing">ITR Filing</option>
      <option value="GST Registration">GST Registration</option>
      <option value="Audit & Compliance">Audit & Compliance</option>
    `;
  } else {
    select.innerHTML = `
      <option value="Home Loan">Home Loan</option>
      <option value="Personal Loan">Personal Loan</option>
      <option value="Business Loan">Business Loan</option>
      <option value="Direct Outreach">Direct Outreach</option>
    `;
  }
}

function parseCsvOrTextContent(content, hasHeader) {
  if (!content || !content.trim()) return [];
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  const isDirectOutreach = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach');

  const hasHeaderRow = (typeof hasHeader === 'boolean')
    ? hasHeader
    : (el("bulkHasHeaderCheck") ? el("bulkHasHeaderCheck").checked : true);

  const startIndex = hasHeaderRow ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const delimiter = ",";

    const parts = line.split(delimiter).map(p => p.trim().replace(/^["']|["']$/g, ''));
    if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

    // Strict column assignment: column 1 = name, column 2 = phone
    const contactPerson = parts[0] || "";
    const rawPhone = parts[1] || "";
    const category = parts[2] || "";
    const amount = parts[3] || "";

    const digits = rawPhone.replace(/\D/g, "");
    const isValidPhone = digits.length === 10 || (digits.length === 12 && digits.startsWith("91"));
    const extraParams = isDirectOutreach ? [contactPerson, ...parts.slice(2)] : [];

    rows.push({
      contactPerson: contactPerson || `Client ${digits.slice(-4) || i + 1}`,
      rawPhone,
      digits,
      category: isDirectOutreach ? "Direct Outreach" : (category || el("bulkCategorySelect")?.value || "Direct Intake"),
      amountRequired: isDirectOutreach ? null : amount,
      templateParams: extraParams,
      isValid: isValidPhone
    });
  }

  return rows;
}

function renderBulkImportPreview(rows) {
  parsedBulkClients = rows;
  const tbody = el("bulkPreviewTableBody");
  const badge = el("bulkParsedBadge");
  const submitBtn = el("btnExecuteBulkImport");
  const isDirectOutreach = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach');

  const validCount = rows.filter(r => r.isValid).length;
  const invalidCount = rows.length - validCount;

  if (badge) {
    badge.textContent = `${validCount} valid (${invalidCount} invalid)`;
    badge.style.color = validCount > 0 ? "#166534" : "#64748B";
  }

  if (submitBtn) {
    submitBtn.disabled = (validCount === 0);
    updateBulkSubmitButtonLabel();
  }

  if (!tbody) return;
  tbody.innerHTML = "";

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #94A3B8; padding: 20px;">No client records loaded yet. Upload a CSV file above.</td></tr>`;
    return;
  }

  rows.slice(0, 100).forEach(r => {
    const tr = document.createElement("tr");
    if (isDirectOutreach) {
      const paramText = (r.templateParams && r.templateParams.length > 1) 
        ? r.templateParams.slice(1).join(", ") 
        : "—";
      tr.innerHTML = `
        <td>
          <span class="row-status-pill ${r.isValid ? 'valid' : 'invalid'}">
            ${r.isValid ? '✓ Valid' : '✕ Invalid'}
          </span>
        </td>
        <td style="font-weight: 500;">${escapeHtml(r.contactPerson)}</td>
        <td><code style="font-size: 12px; background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(r.rawPhone || 'Missing')}</code></td>
        <td colspan="2"><span style="color: #64748B; font-size: 12px;">Params: ${escapeHtml(paramText)}</span></td>
      `;
    } else {
      tr.innerHTML = `
        <td>
          <span class="row-status-pill ${r.isValid ? 'valid' : 'invalid'}">
            ${r.isValid ? '✓ Valid' : '✕ Invalid'}
          </span>
        </td>
        <td style="font-weight: 500;">${escapeHtml(r.contactPerson)}</td>
        <td><code style="font-size: 12px; background: #F1F5F9; padding: 2px 6px; border-radius: 4px;">${escapeHtml(r.rawPhone || 'Missing')}</code></td>
        <td>${escapeHtml(r.category || '—')}</td>
        <td>${r.amountRequired ? escapeHtml(r.amountRequired) : '—'}</td>
      `;
    }
    tbody.appendChild(tr);
  });

  if (rows.length > 100) {
    const moreTr = document.createElement("tr");
    moreTr.innerHTML = `<td colspan="5" style="text-align: center; font-weight: 600; color: #64748B; padding: 8px;">+ ${rows.length - 100} more rows loaded</td>`;
    tbody.appendChild(moreTr);
  }
}

function handleBulkFileSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result || "";
    lastBulkFileContent = text;
    const hasHeader = el("bulkHasHeaderCheck") ? el("bulkHasHeaderCheck").checked : true;
    const rows = parseCsvOrTextContent(text, hasHeader);
    renderBulkImportPreview(rows);
    if (typeof UI !== 'undefined' && UI.toast) {
      UI.toast(`Parsed ${rows.length} rows from ${file.name}`, "info");
    }
  };
  reader.readAsText(file);
}

function downloadSampleCsv() {
  const isDirectOutreach = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach');
  let csvContent = "";
  if (isDirectOutreach) {
    csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(
      "Name,Phone,Param2,Param3\n" +
      "John Doe,9876543210,Notice_123,24-Aug-2026\n" +
      "Priya Patel,9876543211,Notice_124,25-Aug-2026\n"
    );
  } else {
    csvContent = "data:text/csv;charset=utf-8," + encodeURIComponent(
      "Name,Phone,Category,Amount\n" +
      "John Doe,9876543210,Direct Intake,500000\n" +
      "Priya Patel,9876543211,ITR Filing,250000\n" +
      "Rahul Sharma,9823456789,GST Registration,\n"
    );
  }
  const link = document.createElement("a");
  link.setAttribute("href", csvContent);
  link.setAttribute("download", isDirectOutreach ? "direct_outreach_targets_sample.csv" : "collectrr_clients_sample.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

async function executeBulkImport() {
  const validRows = parsedBulkClients.filter(r => r.isValid);
  if (validRows.length === 0) return;

  const submitBtn = el("btnExecuteBulkImport");
  const errBox = el("bulkImportError");
  if (errBox) errBox.hidden = true;

  const isDirectOutreach = (typeof window.getVariantKey === 'function' && window.getVariantKey() === 'direct_outreach');
  const defaultCategory = isDirectOutreach ? "Direct Outreach" : (el("bulkCategorySelect")?.value || "Direct Intake");
  const templateName = el("bulkTemplateSelect")?.value || "new_convo_1";
  const sendWhatsApp = el("bulkSendWhatsAppCheck")?.checked !== false;

  const payload = {
    clients: validRows.map(r => ({
      contactPerson: r.contactPerson,
      phoneNumber: r.digits || r.rawPhone,
      loanProduct: r.category || defaultCategory,
      amountRequired: isDirectOutreach ? null : r.amountRequired,
      templateParams: r.templateParams || []
    })),
    defaultLoanProduct: defaultCategory,
    templateName: templateName,
    sendWhatsApp: sendWhatsApp,
    noDocsRequired: isDirectOutreach
  };

  if (sendWhatsApp && bulkScheduleState) {
    payload.schedule = bulkScheduleState;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = (sendWhatsApp && bulkScheduleState)
      ? `Scheduling outreach for ${validRows.length} clients...`
      : `Importing ${validRows.length} clients...`;
  }

  try {
    const res = await authFetch("/api/cases/bulk-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Failed to import client batch.");

    const totalParsedCount = (Array.isArray(parsedBulkClients) ? parsedBulkClients.length : validRows.length);
    const skippedInvalidCount = totalParsedCount - validRows.length;
    const importedCount = data.importedCount || 0;
    const backendFailedCount = data.failedCount || 0;
    const actionWord = data.scheduled ? "scheduled" : (data.queued ? "imported (outreach queued)" : "imported");

    if (typeof UI !== 'undefined' && UI.toast) {
      if (skippedInvalidCount > 0 && backendFailedCount > 0) {
        UI.toast(`${importedCount} clients ${actionWord} (${backendFailedCount} failed) · ${skippedInvalidCount} invalid rows skipped`, "warning");
      } else if (skippedInvalidCount > 0) {
        UI.toast(`${importedCount} clients ${actionWord} · ${skippedInvalidCount} invalid rows skipped`, "success");
      } else if (backendFailedCount > 0) {
        UI.toast(`${importedCount} clients ${actionWord} · ${backendFailedCount} failed`, "warning");
      } else {
        UI.toast(data.queued ? `${importedCount} clients imported · outreach queued for delivery` : `Successfully ${actionWord} ${importedCount} clients!`, "success");
      }
    }

    closeBulkImportModal();
    if (typeof load === 'function') load();
    if (typeof fetchUserCredits === 'function') fetchUserCredits();
  } catch (err) {
    if (errBox) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      updateBulkSubmitButtonLabel();
    }
  }
}

const bulkTemplateSelectEl = el("bulkTemplateSelect");
if (bulkTemplateSelectEl) {
  bulkTemplateSelectEl.addEventListener("change", updateBulkSampleFormat);
}

// Wire Bulk Import trigger buttons and dropzone events
const btnOpenBulkImportModal = el("btnOpenBulkImportModal");
if (btnOpenBulkImportModal) {
  btnOpenBulkImportModal.addEventListener("click", openBulkImportModal);
}

const closeBulkImportModalBtn = el("closeBulkImportModal");
if (closeBulkImportModalBtn) {
  closeBulkImportModalBtn.addEventListener("click", closeBulkImportModal);
}

const cancelBulkImportModalBtn = el("cancelBulkImportModal");
if (cancelBulkImportModalBtn) {
  cancelBulkImportModalBtn.addEventListener("click", closeBulkImportModal);
}

const bulkHasHeaderCheck = el("bulkHasHeaderCheck");
if (bulkHasHeaderCheck) {
  bulkHasHeaderCheck.addEventListener("change", () => {
    if (lastBulkFileContent) {
      const rows = parseCsvOrTextContent(lastBulkFileContent, bulkHasHeaderCheck.checked);
      renderBulkImportPreview(rows);
    }
  });
}

const bulkFileInput = el("bulkFileInput");
if (bulkFileInput) {
  bulkFileInput.addEventListener("change", (e) => {
    const file = e.target?.files?.[0];
    if (file) handleBulkFileSelected(file);
  });
}

const bulkDropzone = el("bulkDropzone");
if (bulkDropzone) {
  bulkDropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    bulkDropzone.classList.add("dragover");
  });
  bulkDropzone.addEventListener("dragleave", () => {
    bulkDropzone.classList.remove("dragover");
  });
  bulkDropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    bulkDropzone.classList.remove("dragover");
    const file = e.dataTransfer?.files?.[0];
    if (file) handleBulkFileSelected(file);
  });
}

// Make functions globally available
window.openTemplateModal = openTemplateModal;
window.closeTemplateModal = closeTemplateModal;
window.switchTemplateTab = switchTemplateTab;
window.insertTemplateToken = insertTemplateToken;
window.saveCustomTemplate = saveCustomTemplate;
window.deleteCustomTemplate = deleteCustomTemplate;
window.editCustomTemplate = editCustomTemplate;

window.openBulkImportModal = openBulkImportModal;
window.closeBulkImportModal = closeBulkImportModal;
window.downloadSampleCsv = downloadSampleCsv;
window.executeBulkImport = executeBulkImport;
window.parseCsvOrTextContent = parseCsvOrTextContent;

window.getDisplayStatus = getDisplayStatus;
window.formatWhatsAppDeliveryStatus = formatWhatsAppDeliveryStatus;
window.formatStatus = formatStatus;
window.WHATSAPP_STATUS_ORDER = WHATSAPP_STATUS_ORDER;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getDisplayStatus,
    formatWhatsAppDeliveryStatus,
    formatStatus,
    WHATSAPP_STATUS_ORDER
  };
}

if (window.applyVariantToDOM) {
  window.applyVariantToDOM();
}

// Auto-fetch user credits on initialization
document.addEventListener("DOMContentLoaded", () => {
  fetchUserCredits().catch(() => {});
});

