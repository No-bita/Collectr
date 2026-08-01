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

  filterEl.innerHTML = '<option value="all">All Loan Types</option>';
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
  const statusSet = new Set();

  (allCases || []).forEach(c => {
    if (c.status) statusSet.add(c.status);
  });

  filterEl.innerHTML = '<option value="all">All Statuses</option>';
  statusSet.forEach(st => {
    const opt = document.createElement("option");
    opt.value = st;
    opt.textContent = formatStatus(st);
    filterEl.appendChild(opt);
  });

  if (statusSet.has(currentVal) || currentVal === "all") {
    filterEl.value = currentVal;
  } else {
    filterEl.value = "all";
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

function render() {
  const tbody = el("tbody");
  const q = el("search").value.trim().toLowerCase();
  const selectedStatus = statusFilter || "all";
  const selectedLoanType = el("loanTypeFilter") ? el("loanTypeFilter").value : "all";
  const selectedAmount = el("amountFilter") ? el("amountFilter").value : "all";

  const filtered = allCases.filter(c => {
    if (selectedStatus !== "all" && c.status !== selectedStatus) return false;
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

  // Update Footer Count
  const footerCountEl = el("footerCasesCount");
  if (footerCountEl) {
    footerCountEl.textContent = totalItems > 0 ? `Showing ${startIdx} to ${endIdx} of ${totalItems} cases` : `Showing 0 cases`;
  }

  renderPaginationControls(totalItems);

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          <div class="empty-state-card">
            <div class="empty-state-icon">🔍</div>
            <div class="empty-state-title">No matching loan cases found</div>
            <div class="empty-state-sub">Try searching with a different customer name, mobile number, or adjusting your status filter.</div>
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
      <td>
        <div class="amount-val">${formatAmountDisplay(c.amountRequired)}</div>
      </td>
      <td>
        <div class="doc-prog-wrapper">
          <div style="flex: 1;">
            <div class="doc-prog-track">
              <div class="doc-prog-fill" style="width: ${pct}%; background-color: ${progressColor};"></div>
            </div>
            <div class="doc-prog-sub">${prog.fulfilled} / ${prog.total} docs</div>
          </div>
          <div class="doc-prog-text">${pct}%</div>
        </div>
      </td>
      <td>
        <div class="next-action-main" style="color: ${nextAction.color};">
          ${escapeHtml(nextAction.main)}
        </div>
      </td>
      <td>
        <span class="badge badge-${c.status}">${formatStatus(c.status)}</span>
      </td>
      <td style="text-align: center;" onclick="event.stopPropagation();">
        <button type="button" class="row-copy-btn" title="Copy Client Upload Link" onclick="copyCaseUploadLink('${c.token}', this)">
          📋 Copy Link
        </button>
      </td>
    `;

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

  return `
    <div class="case-drawer">
      <div class="drawer-card">
        <div class="drawer-card-title">
          <span>Case Documents (${prog.fulfilled}/${prog.total} Requirements Fulfilled)</span>
          ${allDocsSubmitted ? `<span class="badge badge-approved" style="font-size: 0.7rem;">100% Complete</span>` : ''}
        </div>
        ${docsHtml}
      </div>

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
          ${c.token ? `
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

  body.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 1.25rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
      <div>
        <div style="font-size: 0.75rem; font-weight: 600; color: #64748b; text-transform: uppercase;">Loan Approval Readiness</div>
        <div style="font-size: 1.5rem; font-weight: 700; color: #0f172a; margin-top: 0.2rem;">${escapeHtml(r.readinessGrade)}</div>
        <div style="font-size: 0.8125rem; color: #475569; margin-top: 0.25rem;">Client: <strong>${escapeHtml(c.contactPerson)}</strong> | Product: <strong>${escapeHtml(c.loanProduct)}</strong> | Amount: <strong>${formatLacs(c.amountRequired)}</strong></div>
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
    if (timeline.length === 0) {
      container.innerHTML = '<p style="color: #94a3b8; font-size: 0.75rem;">No timeline activity recorded yet.</p>';
      return;
    }

    container.innerHTML = timeline.map(t => {
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

      return `
        <div class="timeline-mini-item">
          <div>${escapeHtml(t.content)}</div>
          <div class="timeline-mini-time">${formattedTime}</div>
        </div>
      `;
    }).join("");
  } catch (err) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 0.75rem;">Could not load timeline history.</p>';
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
  const tot = el("statTotal"); if (tot) tot.textContent = summary.total || 0;
  const pen = el("statPending"); if (pen) pen.textContent = summary.documentsPending || 0;
  const rev = el("statReview"); if (rev) rev.textContent = summary.readyForReview || 0;
  const sub = el("statSubmitted"); if (sub) sub.textContent = summary.submitted || 0;
  const dis = el("statDisbursed"); if (dis) dis.textContent = summary.disbursed || 0;
}

async function loadLoanProducts() {
  try {
    const res = await authFetch("/api/loan-products");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    loanProductsList = data.loanProducts || [];
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
  "Working Capital Loan": ["pan", "aadhaar", "bank_statement", "gst_returns"],
  "Machinery Loan": ["pan", "aadhaar", "bank_statement", "gst_returns", "quotation"],
  "Property Loan / LAP": ["pan", "aadhaar", "bank_statement", "property_docs", "itr"],
  "Unsecured Business Loan": ["pan", "aadhaar", "bank_statement", "gst_returns"]
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

  const p = (prodLabel || "").toLowerCase();
  if (p.includes("machinery") || p.includes("equipment")) {
    return documentCatalog.filter(d => ['pan', 'aadhaar', 'bank_statement', 'gst_returns', 'quotation'].includes(d.id));
  }
  if (p.includes("property") || p.includes("lap")) {
    return documentCatalog.filter(d => ['pan', 'aadhaar', 'bank_statement', 'property_docs', 'itr'].includes(d.id));
  }
  return documentCatalog.filter(d => ['pan', 'aadhaar', 'bank_statement', 'gst_returns'].includes(d.id));
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
  select.innerHTML = '<option value="" disabled selected>Select Loan Type...</option>';

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

el("loanProductSelect").addEventListener("change", (e) => {
  const customGroup = el("customProductGroup");
  if (e.target.value === "__custom__") {
    customGroup.hidden = false;
    el("customProductInput").focus();
  } else {
    customGroup.hidden = true;
  }
  updateLiveDocPreview();
});

async function loadDocumentCatalog() {
  try {
    const res = await authFetch("/api/document-catalog");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    documentCatalog = data.documentCatalog || [];
    renderRequiredDocsCheckboxes();
  } catch (e) {
    console.error("Failed catalog load", e);
  }
}

function renderRequiredDocsCheckboxes() {
  const container = el("requiredDocsFields");
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
  if (dashErr) dashErr.hidden = true;

  try {
    await Promise.all([loadLoanProducts(), loadDocumentCatalog(), loadProductMappings()]);
    const res = await authFetch("/api/cases");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Unable to retrieve loan cases from server. Please refresh.");

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
    if (dashErr) {
      dashErr.textContent = "Dashboard Load Error: " + e.message;
      dashErr.hidden = false;
    }
    const tbody = el("tbody");
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #b91c1c;">${escapeHtml(e.message)}</td></tr>`;
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
    const detailsForm = el("detailsForm");
    if (detailsForm) detailsForm.reset();
    if (el("phone")) el("phone").classList.remove("input-error");
    if (el("contactPerson")) el("contactPerson").classList.remove("input-error");
    if (el("amountRequired")) el("amountRequired").classList.remove("input-error");
    if (el("customProductGroup")) el("customProductGroup").hidden = true;
    if (el("liveDocPreviewContainer")) el("liveDocPreviewContainer").hidden = true;
    if (el("modalErrorStep1")) el("modalErrorStep1").hidden = true;
    if (el("modalErrorStep2")) el("modalErrorStep2").hidden = true;
    setWizardScreen('details');
    if (el("modalBackdrop")) el("modalBackdrop").hidden = false;
  });
}

const closeModalBtn = el("closeModal");
if (closeModalBtn) closeModalBtn.addEventListener("click", () => { if (el("modalBackdrop")) el("modalBackdrop").hidden = true; });

const cpInput = el("contactPerson");
if (cpInput) {
  cpInput.addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^a-zA-Z\s.\-]/g, "");
  });
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

    const contactPerson = contactPersonInput ? contactPersonInput.value.trim() : "";
    if (!contactPerson) {
      if (contactPersonInput) contactPersonInput.classList.add("input-error");
      showActionableError("Please enter the contact person's full name.", "modalErrorStep1");
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

    let selectedProduct = el("loanProductSelect").value;
    if (!selectedProduct) {
      showActionableError("Please select a loan type from the dropdown list.", "modalErrorStep1");
      el("loanProductSelect").focus();
      return;
    }

    if (selectedProduct === "__custom__") {
      const customLabel = el("customProductInput").value.trim();
      if (!customLabel) {
        showActionableError("Please enter a name for your custom loan type.", "modalErrorStep1");
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
        if (!prodRes.ok) throw new Error(prodData.error || "Could not save custom loan product.");
        selectedProduct = customLabel;
      } catch (prodErr) {
        showActionableError(`Failed to save new product: ${prodErr.message}`, "modalErrorStep1");
        return;
      }
    }

    let amountRequired = null;
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

    // Save to State Machine
    wizardState.customer = { contactPerson, phone: rawPhone };
    wizardState.loan = { product: selectedProduct, amountRequired };

    renderScreen2DocChecklists();
    setWizardScreen('documents');
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

    const selectedDocs = Array.from(document.querySelectorAll("input[data-doc]:checked")).map(cb => cb.value);
    if (selectedDocs.length === 0) {
      showActionableError("Please select at least one document requirement for this loan case.", "modalErrorStep2");
      return;
    }

    wizardState.documents.selectedIds = selectedDocs;
    submitBtn.disabled = true;

    try {
      const postBody = {
        contactPerson: wizardState.customer.contactPerson,
        phone: wizardState.customer.phone,
        loanProduct: wizardState.loan.product,
        amountRequired: wizardState.loan.amountRequired,
        requiredDocIds: wizardState.documents.selectedIds
      };

      const res = await authFetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(postBody)
      });
      
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to create loan case.");

      wizardState.generatedCase = { id: data.caseId, token: data.token };

      // Populate Screen 3 Success UI
      const nameEl = el("successCustomerName");
      if (nameEl) nameEl.textContent = wizardState.customer.contactPerson;

      const token = data.token || '';
      const shareUrl = `${window.location.origin}/upload.html?t=${token}`;

      const waBtn = el("btnShareWhatsApp");
      if (waBtn) {
        const waText = encodeURIComponent(`Hello ${wizardState.customer.contactPerson}, please upload your loan documents for ${wizardState.loan.product} here: ${shareUrl}`);
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
  if (!tokenHeader) return null;
  try {
    const rawToken = tokenHeader.replace(/^Bearer\s+/i, '').trim();
    const parts = rawToken.split('.');
    if (parts.length !== 3) return null;
    const payloadJson = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(payloadJson);
  } catch (e) {
    return null;
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

  const userContainer = document.querySelector('.sidebar-user');
  if (userContainer) {
    userContainer.style.cursor = 'pointer';
    userContainer.title = 'Click to log out';
    userContainer.onclick = async () => {
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
  }
}

// Initial load
setupSidebarToggle();
updateUserProfileUI();
load();

function renderMappingConfiguratorMatrix() {
  const headerRow = el("mappingMatrixHeaderRow");
  const tbody = el("mappingMatrixTableBody");
  if (!headerRow || !tbody) return;

  headerRow.innerHTML = "<th>Loan Product</th>";
  documentCatalog.forEach(doc => {
    const th = document.createElement("th");
    th.style.textAlign = "center";
    th.textContent = doc.label;
    headerRow.appendChild(th);
  });

  tbody.innerHTML = "";
  
  const products = (loanProductsList && loanProductsList.length > 0) 
    ? loanProductsList.map(p => p.label) 
    : ["Working Capital", "Term Loan", "Machinery Loan", "Loan Against Property (LAP)"];

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
