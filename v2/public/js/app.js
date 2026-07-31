let allCases = [];
let documentCatalog = [];
let loanProductsList = [];
let statusFilter = "all";
let expandedCaseId = null;

const el = (id) => document.getElementById(id);

async function authFetch(url, options = {}) {
  const token = localStorage.getItem('collectrr_auth');
  if (!token) {
    window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
    throw new Error("Authentication required");
  }

  const headers = {
    ...options.headers,
    'Authorization': token
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
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
    lender_query: "Lender Query",
    approved: "Approved",
    disbursed: "Disbursed",
    closed: "Closed"
  };
  return map[status] || status;
}

function render() {
  const tbody = el("tbody");
  const q = el("search").value.trim().toLowerCase();
  
  const filtered = allCases.filter(c => {
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (q) {
      const matchContact = (c.contactPerson || "").toLowerCase().includes(q);
      const matchPhone = (c.phone || "").toLowerCase().includes(q);
      const matchProduct = (c.loanProduct || "").toLowerCase().includes(q);
      return matchContact || matchPhone || matchProduct;
    }
    return true;
  });

  tbody.innerHTML = "";
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #64748b;">No matching loan cases found. Try adjusting your search or status filter.</td></tr>';
    return;
  }

  filtered.forEach((c, idx) => {
    const tr = document.createElement("tr");
    tr.className = "case-row";
    tr.style.cursor = "pointer";
    const prog = c.docProgress || { fulfilled: 0, total: 0 };

    tr.innerHTML = `
      <td>${idx + 1}</td>
      <td>
        <strong>${escapeHtml(c.contactPerson || '—')}</strong>
        ${c.isDemo ? '<span class="tag" style="font-size: 0.65rem; background: #e2e8f0; color: #475569; margin-left: 0.35rem; font-weight: 600;">Demo</span>' : ''}
      </td>
      <td>${escapeHtml(c.loanProduct || '—')}</td>
      <td>${formatLacs(c.amountRequired)}</td>
      <td>${prog.fulfilled} / ${prog.total} fulfilled</td>
      <td><span class="badge badge-${c.status}">${formatStatus(c.status)}</span></td>
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
            <span>${escapeHtml(req.label || req.type)}</span>
            <span class="badge ${isReceived ? 'badge-approved' : 'badge-lead'}" style="font-size: 0.7rem;">
              ${isReceived ? 'Received' : 'Pending Upload'}
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
  } catch(err) {
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
  customOpt.textContent = "+ Add New Custom Loan Type...";
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
});

async function loadDocumentCatalog() {
  try {
    const res = await authFetch("/api/document-catalog");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return;
    documentCatalog = data.documentCatalog || [];
    renderRequiredDocsCheckboxes();
  } catch(e) {
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
    await Promise.all([loadLoanProducts(), loadDocumentCatalog()]);
    const res = await authFetch("/api/cases");
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Unable to retrieve loan cases from server. Please refresh.");
    
    allCases = data.cases || [];
    updateSummary(data.summary || {});
    render();
  } catch(e) {
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

function showActionableError(msg) {
  const errBox = el("modalError");
  if (errBox) {
    errBox.textContent = msg;
    errBox.hidden = false;
  }
}

// Event Listeners
const refBtn = el("refreshBtn");
if (refBtn) refBtn.addEventListener("click", load);
el("search").addEventListener("input", render);

const statusFilterEl = el("statusFilter");
if (statusFilterEl) {
  statusFilterEl.addEventListener("change", (e) => {
    statusFilter = e.target.value;
    render();
  });
  UI.replaceSelect(statusFilterEl);
}

const loanProdSel = el("loanProductSelect");
if (loanProdSel) {
  UI.replaceSelect(loanProdSel);
}

el("openAdd").addEventListener("click", () => {
  el("addForm").reset();
  el("customProductGroup").hidden = true;
  el("modalError").hidden = true;
  el("modalBackdrop").hidden = false;
});

el("closeModal").addEventListener("click", () => el("modalBackdrop").hidden = true);
el("cancelAdd").addEventListener("click", () => el("modalBackdrop").hidden = true);

el("addForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const errBox = el("modalError");
  const submitBtn = el("submitAdd");
  errBox.hidden = true;

  const rawPhone = el("phone").value.trim();
  if (!/^\d{10}$/.test(rawPhone)) {
    showActionableError("Please enter a valid 10-digit mobile number without country code or spaces (e.g. 9876543210).");
    el("phone").focus();
    return;
  }

  const contactPerson = el("contactPerson").value.trim();
  if (!contactPerson) {
    showActionableError("Please enter the contact person's full name.");
    el("contactPerson").focus();
    return;
  }

  let selectedProduct = el("loanProductSelect").value;
  if (!selectedProduct) {
    showActionableError("Please select a loan type from the dropdown list.");
    el("loanProductSelect").focus();
    return;
  }

  if (selectedProduct === "__custom__") {
    const customLabel = el("customProductInput").value.trim();
    if (!customLabel) {
      showActionableError("Please enter a name for your custom loan type.");
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
      showActionableError(`Failed to save new product: ${prodErr.message}`);
      return;
    }
  }

  let amountRequired = null;
  const rawAmount = el("amountRequired").value.trim();
  if (rawAmount) {
    amountRequired = parseFloat(rawAmount);
    if (isNaN(amountRequired) || amountRequired <= 0) {
      showActionableError("Please enter a valid positive number for Amount Required in Lacs (e.g. 25).");
      el("amountRequired").focus();
      return;
    }
  }

  const selectedDocs = Array.from(document.querySelectorAll("input[data-doc]:checked")).map(cb => cb.value);

  if (selectedDocs.length === 0) {
    showActionableError("Please select at least one document requirement for this loan case.");
    return;
  }

  submitBtn.disabled = true;

  try {
    const postBody = {
      contactPerson,
      phone: rawPhone,
      loanProduct: selectedProduct,
      amountRequired,
      requiredDocIds: selectedDocs
    };

    const res = await authFetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(postBody)
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || "Could not create loan case. Please double-check your inputs.");
    }

    if (data.whatsappWarning) {
      UI.toast(data.whatsappWarning, "warning");
    } else {
      UI.toast("Loan case created successfully!", "success");
    }

    el("modalBackdrop").hidden = true;
    await load();
  } catch(errEx) {
    showActionableError(errEx.message);
  } finally {
    submitBtn.disabled = false;
  }
});

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

  const navAnalytics = document.getElementById("navAnalytics");
  if (navAnalytics) {
    navAnalytics.style.display = (user.role === 'admin') ? '' : 'none';
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
