let currentCase = null;
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
  if (!name) return "--";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
}

async function init() {
  setupSidebarToggle();
  const params = new URLSearchParams(window.location.search);
  const caseId = params.get("id");

  if (!caseId) {
    window.location.href = "/dashboard.html";
    return;
  }

  await loadCaseDetails(caseId);
  loadTimeline(caseId);
}

async function loadCaseDetails(caseId) {
  try {
    const res = await authFetch(`/api/cases/${caseId}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}: Failed to load case`);

    currentCase = data.loanCase;
    if (!currentCase) throw new Error("No loan case data returned for ID: " + caseId);

    renderBanner(currentCase);
    renderDocuments(currentCase.docRequirements || []);
  } catch (err) {
    console.error("loadCaseDetails Error:", err);
    const nameEl = el("clientName");
    if (nameEl) nameEl.textContent = "Error Loading Case";
    const errBox = el("caseError");
    if (errBox) {
      errBox.textContent = "Case Load Error: " + err.message;
      errBox.hidden = false;
    }
  }
}

function maskPhone(phone) {
  if (!phone) return "—";
  const clean = phone.toString().replace(/\D/g, "");
  if (clean.length === 10) return `${clean.slice(0, 2)}*****${clean.slice(7)}`;
  if (clean.length === 12 && clean.startsWith("91")) return `+91 ${clean.slice(2, 4)}*****${clean.slice(9)}`;
  if (clean.length >= 5) return `${clean.slice(0, 2)}*****${clean.slice(-3)}`;
  return phone;
}

function renderBanner(c) {
  const initialsEl = el("clientInitials");
  if (initialsEl) initialsEl.textContent = getInitials(c.contactPerson);
  
  const nameEl = el("clientName");
  if (nameEl) {
    nameEl.innerHTML = `${(c.contactPerson || "Client Case")}${c.isDemo ? ' <span class="tag" style="font-size: 0.75rem; background: #e2e8f0; color: #475569; margin-left: 0.5rem; font-weight: 600;">Demo</span>' : ''}`;
  }
  
  const statusBadge = el("clientStatusBadge");
  if (statusBadge) {
    statusBadge.className = `badge status-badge-prominent badge-${c.status}`;
    statusBadge.textContent = formatStatus(c.status);
  }

  const phoneEl = el("clientPhone");
  if (phoneEl) phoneEl.textContent = maskPhone(c.phone);

  const productEl = el("statProduct");
  if (productEl) productEl.textContent = c.loanProduct || "—";

  const amountEl = el("statAmount");
  if (amountEl) amountEl.textContent = formatLacs(c.amountRequired);

  const prog = c.docProgress || { fulfilled: 0, total: 0 };
  const reqs = c.docRequirements || [];
  const isDirectOutreach = (prog.total === 0 || reqs.length === 0 || c.noDocsRequired || c.noDocs);

  const amountCol = amountEl ? amountEl.closest(".stat-col") : null;
  if (amountCol) amountCol.style.display = isDirectOutreach ? "none" : "";

  const docCountEl = el("statDocCount");
  if (docCountEl) docCountEl.textContent = isDirectOutreach ? "Direct Outreach" : `${prog.fulfilled} / ${prog.total}`;

  const docsPanel = el("docsCardPanel");
  const grid = document.querySelector(".case-content-grid");
  if (docsPanel) docsPanel.style.display = "block";
  if (grid) grid.style.gridTemplateColumns = "";

  const docCol = docCountEl ? docCountEl.closest(".stat-col") : null;
  if (docCol) docCol.style.display = isDirectOutreach ? "none" : "";

  const copyBtn = el("copyLinkBtn");
  const linkCol = copyBtn ? copyBtn.closest(".stat-col") : null;
  if (linkCol) linkCol.style.display = isDirectOutreach ? "none" : "";

  // Docs panel header badge
  const badge = el("docsReceivedBadge");
  if (badge) {
    badge.textContent = `${prog.fulfilled} / ${prog.total} Received`;
    if (prog.fulfilled < prog.total) {
      badge.classList.add("partial");
    } else {
      badge.classList.remove("partial");
    }
  }

  // Dynamic Segment progress bar (1 to 4 pills max)
  const segContainer = el("segProgressBar");
  if (segContainer) {
    segContainer.innerHTML = "";
    const rawTotal = prog.total || 0;
    const numPills = Math.min(4, Math.max(0, rawTotal));

    if (numPills > 0) {
      const filledPills = rawTotal <= 4 
        ? Math.min(numPills, prog.fulfilled) 
        : Math.round((prog.fulfilled / rawTotal) * numPills);

      for (let i = 0; i < numPills; i++) {
        const bar = document.createElement("div");
        bar.className = `seg-bar ${i < filledPills ? 'filled' : ''}`;
        segContainer.appendChild(bar);
      }
    }
  }

  // Status Select sync
  const statusSel = el("caseStatusSelect");
  if (statusSel) statusSel.value = c.status;

  if (copyBtn) {
    copyBtn.onclick = handleCopyUploadLink;
  }
}

function getDocIconClass(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("pan")) return "pan";
  if (t.includes("aadhaar") || t.includes("aadhar")) return "aadhaar";
  if (t.includes("bank")) return "bank";
  if (t.includes("gst")) return "gst";
  return "default";
}

function getDocEmoji(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("pan")) return "📄";
  if (t.includes("aadhaar") || t.includes("aadhar")) return "🪪";
  if (t.includes("bank")) return "🏦";
  if (t.includes("gst")) return "📊";
  return "📁";
}

function formatUploadTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const oneDay = 86400000;

  if (diffMs < oneDay && d.getDate() === now.getDate()) {
    return "Today, " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth()) {
    return "Yesterday, " + d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  }
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function openDocumentPreview(url, label) {
  const backdrop = el("docPreviewBackdrop");
  const titleEl = el("previewDocTitle");
  const downloadBtn = el("previewDownloadBtn");
  const bodyEl = el("previewDocBody");

  if (!backdrop || !url) return;
  if (titleEl) titleEl.textContent = label || "Submitted Document";
  if (downloadBtn) downloadBtn.href = url;

  const isImg = /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url);
  if (isImg) {
    bodyEl.innerHTML = `<img src="${escapeHtml(url)}" class="doc-preview-image" alt="${escapeHtml(label || 'Document')}" />`;
  } else {
    bodyEl.innerHTML = `<iframe src="${escapeHtml(url)}" class="doc-preview-iframe"></iframe>`;
  }

  backdrop.hidden = false;
  requestAnimationFrame(() => backdrop.classList.add("show"));
}

function closeDocumentPreview() {
  const backdrop = el("docPreviewBackdrop");
  if (!backdrop) return;
  backdrop.classList.remove("show");
  setTimeout(() => {
    backdrop.hidden = true;
    const bodyEl = el("previewDocBody");
    if (bodyEl) bodyEl.innerHTML = "";
  }, 200);
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
  const typeKey = String(req.type || req.document_type || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[typeKey]) return DOCUMENT_CATALOG_MAP[typeKey];
  const labelKey = String(req.label || '').toLowerCase();
  if (DOCUMENT_CATALOG_MAP[labelKey]) return DOCUMENT_CATALOG_MAP[labelKey];
  return req.label || req.type || 'Document';
}

function renderDocuments(reqs) {
  const container = el("reqDocsContainer");
  if (!container) return;
  if (!reqs || reqs.length === 0) {
    container.innerHTML = '<p style="color: #64748b; font-size: 0.875rem; padding: 1rem;">No document requirements specified.</p>';
    return;
  }

  container.innerHTML = "";
  reqs.forEach((req, idx) => {
    const uploads = req.uploads || [];
    const hasUploads = uploads.length > 0;
    const isReceived = req.status === 'received' || hasUploads;

    const fileCountText = hasUploads ? `${uploads.length} file${uploads.length > 1 ? "s" : ""}` : "";
    const ocrCount = uploads.filter(u => u.ocrStatus === "processed").length;
    const ocrText = ocrCount > 0 ? ` • OCR completed` : "";
    const subtext = hasUploads ? `${fileCountText}${ocrText}` : "";
    const latestUploadTime = hasUploads ? formatUploadTime(uploads[uploads.length - 1].uploadedAt || uploads[uploads.length - 1].uploaded_at) : "";

    // Primary view file link (first uploaded file)
    const primaryLink = hasUploads && uploads[0].link ? uploads[0].link : null;
    const label = getDocumentLabel(req);

    const row = document.createElement("div");
    row.className = "doc-row";
    row.innerHTML = `
      <div class="doc-row-info">
        <div>
          <div class="doc-row-name">${escapeHtml(label)}</div>
          ${subtext ? `<div class="doc-row-sub">${subtext}</div>` : ''}
        </div>
      </div>
      <div class="doc-row-status">
        ${isReceived
          ? `<span class="status-received">Received</span>`
          : `<span class="status-pending">Pending</span>`
        }
        ${latestUploadTime ? `<span class="doc-row-timestamp">${latestUploadTime}</span>` : ""}
      </div>
      <div class="doc-row-actions" style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
        ${primaryLink
          ? `<button type="button" class="view-file-btn" onclick="openDocumentPreview('${primaryLink}', '${escapeHtml(label)}')">👁️ Preview</button>
             <a href="${primaryLink}" target="_blank" download class="view-file-btn" style="color: #64748b; font-weight: 500;">⬇️ Download</a>`
          : ''
        }
        <button type="button" class="btn btn-secondary" style="height: 32px; padding: 0 10px; font-size: 13px; font-weight: 500;" onclick="triggerInlineRowUpload('${req.id}', '${escapeHtml(label)}')">
          Manually upload
        </button>
      </div>
    `;
    container.appendChild(row);
  });
}

function formatCleanDeliveryError(msg) {
  if (!msg) return "Message delivery failed.";
  if (msg.includes("(#132018)")) return "Template parameter mismatch on Meta WhatsApp. (Meta Code 132018)";
  if (msg.includes("(#132001)")) return "Template not found on Meta in selected language. (Meta Code 132001)";
  if (msg.includes("(#100)")) return "Invalid parameter provided to WhatsApp API.";
  if (msg.includes("tplConfig is not defined")) return "Template configuration error (resolved in latest update).";
  if (msg.includes("(Attempts:")) {
    const parts = msg.split("(Attempts:");
    return parts[0].replace(/^WhatsApp message delivery failed:\s*/i, "").trim();
  }
  return msg.replace(/^WhatsApp message delivery failed:\s*/i, "");
}

function renderWhatsAppConversationCard(c, timeline) {
  const panel = el("docsCardPanel");
  if (!panel || !c) return;

  const waStatus = c.whatsappDeliveryStatus || c.whatsapp_delivery_status || 'none';
  let badgeStyle = "background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0;";
  let badgeLabel = "WhatsApp";
  if (waStatus === 'sent') {
    badgeStyle = "background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0;";
    badgeLabel = "Sent";
  } else if (waStatus === 'replied') {
    badgeStyle = "background: #DBEAFE; color: #1D4ED8; border: 1px solid #BFDBFE;";
    badgeLabel = "Replied by Client";
  } else if (waStatus === 'failed') {
    badgeStyle = "background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5;";
    badgeLabel = "Delivery Failed";
  }

  const threadEvents = (timeline || []).filter(t => {
    const content = (t.content || "").toLowerCase();
    return t.event_type === 'whatsapp_sent' || t.event_type === 'whatsapp_reply' || t.event_type === 'whatsapp_failed' || content.includes("whatsapp");
  }).slice().reverse();

  let chatHtml = "";
  if (threadEvents.length === 0) {
    chatHtml = '<p style="color: #64748b; font-size: 0.8125rem; text-align: center; margin: 1.5rem 0;">No WhatsApp conversation history yet. Send a message below to start.</p>';
  } else {
    chatHtml = threadEvents.map(t => {
      const isClient = t.created_by === 'client' || t.event_type === 'whatsapp_reply';
      const isFailed = t.event_type === 'whatsapp_failed' || (t.metadata && t.metadata.whatsapp_status === 'failed');

      let isoStr = t.created_at || "";
      if (isoStr && !isoStr.endsWith("Z") && !isoStr.includes("+")) isoStr = isoStr.replace(" ", "T") + "Z";
      const timeStr = isoStr ? new Date(isoStr).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "";

      if (isClient) {
        return `
          <div style="display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px;">
            <div style="font-size: 0.6875rem; color: #64748b; margin-bottom: 3px; font-weight: 600;">${escapeHtml(c.contactPerson || 'Client')} • ${timeStr}</div>
            <div style="background: #F1F5F9; color: #0F172A; border: 1px solid #E2E8F0; padding: 10px 14px; border-radius: 14px 14px 14px 2px; max-width: 85%; font-size: 0.875rem; line-height: 1.4; word-break: break-word;">
              ${escapeHtml((t.content || "").replace(/^Client WhatsApp Reply:\s*/i, ''))}
            </div>
          </div>
        `;
      } else if (isFailed) {
        const cleanContent = formatCleanDeliveryError(t.content);
        return `
          <div style="display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 10px;">
            <div style="font-size: 0.6875rem; color: #DC2626; margin-bottom: 3px; font-weight: 600;">Delivery Issue • ${timeStr}</div>
            <div style="background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; padding: 10px 14px; border-radius: 14px 14px 2px 14px; max-width: 85%; font-size: 0.875rem; line-height: 1.4; word-break: break-word;">
              ${escapeHtml(cleanContent)}
              <div style="margin-top: 6px; text-align: right;">
                <button type="button" onclick="handleTimelineRetryWhatsApp('${c.id}')" style="background: #DC2626; color: #ffffff; border: none; font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">🔄 Retry WhatsApp</button>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div style="display: flex; flex-direction: column; align-items: flex-end; margin-bottom: 10px;">
            <div style="font-size: 0.6875rem; color: #166534; margin-bottom: 3px; font-weight: 600;">Agent • ${timeStr}</div>
            <div style="background: #DCFCE7; color: #14532D; border: 1px solid #BBF7D0; padding: 10px 14px; border-radius: 14px 14px 2px 14px; max-width: 85%; font-size: 0.875rem; line-height: 1.4; word-break: break-word;">
              ${escapeHtml(t.content)}
            </div>
          </div>
        `;
      }
    }).join("");
  }

  panel.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #ECE8DF; padding-bottom: 0.875rem;">
      <div>
        <h3 style="margin: 0; font-size: 1.125rem; font-weight: 700; color: #171717; display: flex; align-items: center; gap: 8px;">
          💬 WhatsApp Outreach Conversation
        </h3>
        <p style="margin: 3px 0 0 0; font-size: 0.8125rem; color: #6E6A62;">Live target messages & incoming WhatsApp replies</p>
      </div>
      <span class="badge" style="${badgeStyle} font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 6px;">WhatsApp: ${badgeLabel}</span>
    </div>

    <div id="waThreadFeed" style="min-height: 240px; max-height: 380px; overflow-y: auto; display: flex; flex-direction: column; padding: 14px; border: 1px solid #ECE8DF; border-radius: 12px; background: #FCFBF8; margin-bottom: 1rem;">
      ${chatHtml}
    </div>

    <form id="waDirectSendForm" style="display: flex; gap: 8px; align-items: center;" onsubmit="handleDirectWhatsAppSend(event, '${c.id}')">
      <input type="text" id="waDirectSendInput" placeholder="Type WhatsApp message to send..." style="flex: 1; height: 42px; padding: 0 1rem; background: #ffffff; border: 1px solid #ECE8DF; border-radius: 10px; font-size: 14px; color: #171717; outline: none;" required />
      <button type="submit" class="btn btn-primary" id="waDirectSendBtn" style="height: 42px; padding: 0 1.25rem; font-weight: 600; white-space: nowrap; border-radius: 10px;">
        Send WhatsApp ➔
      </button>
    </form>
  `;

  const chatFeed = el("waThreadFeed");
  if (chatFeed) chatFeed.scrollTop = chatFeed.scrollHeight;
}

async function handleDirectWhatsAppSend(e, caseId) {
  if (e) e.preventDefault();
  const input = el("waDirectSendInput");
  const btn = el("waDirectSendBtn");
  if (!input || !input.value.trim()) return;

  const msg = input.value.trim();
  input.value = "";
  if (btn) btn.disabled = true;

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
    if (btn) btn.disabled = false;
    loadTimeline(caseId);
  }
}

async function loadTimeline(caseId) {
  const container = el("timelineFeed");
  try {
    const res = await authFetch(`/api/cases/${caseId}/timeline`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed");

    const timeline = data.timeline || [];
    const globalWaStatus = data.whatsappDeliveryStatus || (currentCase ? currentCase.whatsappDeliveryStatus : 'none');
    const globalWaError = data.whatsappErrorDetails || (currentCase ? currentCase.whatsappErrorDetails : null);

    if (currentCase) {
      const prog = currentCase.docProgress || { total: 0 };
      const reqs = currentCase.docRequirements || [];
      const isDirectOutreach = (prog.total === 0 || reqs.length === 0 || currentCase.noDocsRequired || currentCase.noDocs);
      if (isDirectOutreach) {
        renderWhatsAppConversationCard(currentCase, timeline);
      }
    }

    if (timeline.length === 0) {
      container.innerHTML = '<p style="color: #64748b; font-size: 0.875rem;">No timeline activity recorded yet.</p>';
      return;
    }

    container.innerHTML = "";
    timeline.forEach((t, idx) => {
      const item = document.createElement("div");
      item.className = "timeline-feed-item";

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

      let displayContent = t.content || "";
      if (displayContent.includes(". Product:")) {
        displayContent = displayContent.split(". Product:")[0];
      }
      displayContent = displayContent.replace(/^Loan Case created for /i, "Filing request created for ");
      displayContent = displayContent.replace(/^Case created for /i, "Filing request created for ");

      const contentLower = displayContent.toLowerCase();
      const isWhatsAppEvent = t.event_type === 'whatsapp_sent' || t.event_type === 'whatsapp_failed' || contentLower.includes("whatsapp");
      const isWhatsAppFailure = t.event_type === 'whatsapp_failed' || t.type === 'whatsapp_delivery' || t.type === 'system_failure' ||
        (contentLower.includes("whatsapp") && (contentLower.includes("fail") || contentLower.includes("error")));

      let itemMeta = null;
      try {
        if (t.metadata) itemMeta = typeof t.metadata === 'string' ? JSON.parse(t.metadata) : t.metadata;
      } catch(e) {}

      const isFailed = (globalWaStatus === 'failed') || isWhatsAppFailure || (itemMeta && itemMeta.whatsapp_status === 'failed');
      const itemWaStatus = (itemMeta && itemMeta.whatsapp_status) ? itemMeta.whatsapp_status : (isWhatsAppEvent ? (isWhatsAppFailure ? 'failed' : 'sent') : globalWaStatus);

      let waBadgeHtml = "";
      if (itemWaStatus === 'sent' || t.event_type === 'whatsapp_sent') {
        waBadgeHtml = `<span class="badge" style="background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; font-size: 0.6875rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-left: 6px;">WhatsApp: Sent</span>`;
      } else if (itemWaStatus === 'failed' || isFailed) {
        waBadgeHtml = `<span class="badge" style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-size: 0.6875rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-left: 6px;">WhatsApp: Failed</span>`;
      } else if (itemWaStatus === 'sending' || itemWaStatus === 'pending') {
        waBadgeHtml = `<span class="badge" style="background: #FEF3C7; color: #92400E; border: 1px solid #FDE68A; font-size: 0.6875rem; font-weight: 600; padding: 2px 7px; border-radius: 4px; margin-left: 6px;">WhatsApp: Sending</span>`;
      }

      // Render Error Box & Retry Button if WhatsApp failed (render only once on most recent failure)
      let errorBannerHtml = "";
      if (isFailed && idx === 0) {
        const errorText = formatCleanDeliveryError(globalWaError || (itemMeta && itemMeta.error) || "WhatsApp message delivery failed.");
        errorBannerHtml = `
          <div style="margin-top: 10px; padding: 10px 14px; background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;">
            <div style="font-size: 0.8125rem; color: #991B1B; font-weight: 500; flex: 1;">
              ⚠️ <strong style="font-weight: 600;">Delivery Issue:</strong> ${escapeHtml(errorText)}
            </div>
            <button type="button" onclick="handleTimelineRetryWhatsApp('${caseId}')" style="background: #DC2626; color: #ffffff; border: none; font-size: 0.75rem; font-weight: 600; padding: 6px 14px; border-radius: 6px; cursor: pointer; white-space: nowrap; transition: background 150ms ease; display: inline-flex; align-items: center; gap: 4px;">
              🔄 Retry WhatsApp
            </button>
          </div>
        `;
      }

      item.innerHTML = `
        <div class="timeline-content" style="width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;">
            <div style="flex: 1;">
              <div class="timeline-text" style="${isFailed ? 'color: #1E293B; font-weight: 500;' : ''}">${escapeHtml(displayContent)} ${waBadgeHtml}</div>
              <div class="timeline-meta hover-only" style="margin-top: 2px;">${formattedTime} ${t.created_by ? `· by ${escapeHtml(t.created_by)}` : ''}</div>
            </div>
          </div>
          ${errorBannerHtml}
        </div>
      `;
      container.appendChild(item);
    });
  } catch (err) {
    container.innerHTML = '<p style="color: #ef4444; font-size: 0.875rem;">Failed to load timeline history.</p>';
  }
}

async function handleTimelineRetryWhatsApp(caseId) {
  const targetId = caseId || (currentCase && currentCase.id);
  if (!targetId) return;

  const confirmRetry = await UI.confirm({
    title: "Retry WhatsApp Message",
    message: `Retry sending WhatsApp message to ${currentCase ? (currentCase.contactPerson || 'borrower') : 'borrower'}?`,
    confirmText: "Retry WhatsApp",
    isDanger: false
  });
  if (!confirmRetry) return;

  try {
    const res = await authFetch(`/api/cases/${targetId}/retry-whatsapp`, { method: "POST" });
    const data = await res.json();
    if (res.ok && data.success) {
      UI.toast(data.message || "WhatsApp message sent successfully!", "success");
    } else {
      UI.toast(data.error || "Failed to send WhatsApp message.", "error");
    }
  } catch (e) {
    UI.toast(`Error sending WhatsApp message: ${e.message}`, "error");
  } finally {
    if (currentCase) loadCaseDetails(targetId);
    loadTimeline(targetId);
  }
}

async function rejectFile(uploadId) {
  const ok = await UI.confirm({
    title: "Reject Submitted File",
    message: "Are you sure you want to reject this submitted file?",
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
    UI.toast("File rejected successfully.", "info");
    await init();
  } catch (err) {
    UI.toast("Rejection Error: " + err.message, "error");
  }
}

// Add Note Handler
const addNoteBtn = el("addNoteBtn");
if (addNoteBtn) {
  addNoteBtn.onclick = async () => {
    const input = el("noteInput");
    if (!input || !currentCase) return;
    const note = input.value.trim();
    if (!note) return;

    try {
      const res = await authFetch(`/api/cases/${currentCase.id}/timeline`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save note");

      input.value = "";
      UI.toast("Note added to timeline.", "success");
      loadTimeline(currentCase.id);
    } catch (err) {
      UI.toast("Note Error: " + err.message, "error");
    }
  };
}

// Status Select Change Handler
const statusSelectEl = el("caseStatusSelect");
if (statusSelectEl) {
  statusSelectEl.onchange = async (e) => {
    if (!currentCase) return;
    const newStatus = e.target.value;

    try {
      const res = await authFetch(`/api/cases/${currentCase.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update status");

      UI.toast(`Status updated to ${formatStatus(newStatus)}`, "success");
      await init();
    } catch (err) {
      UI.toast("Status Update Error: " + err.message, "error");
    }
  };
}

// Bottom Case Actions & Modal Handlers
const actReminderBtn = el("actSendReminder");
if (actReminderBtn) {
  actReminderBtn.onclick = async () => {
    if (!currentCase) return;
    try {
      const res = await authFetch(`/api/cases/${currentCase.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendWhatsApp: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reminder");

      if (data.whatsappSent) {
        UI.toast(`WhatsApp reminder sent successfully to ${currentCase.contactPerson} (${currentCase.phone})!`, "success");
      } else {
        UI.toast(`Follow-up logged in timeline.`, "info");
      }
      loadTimeline(currentCase.id);
    } catch (err) {
      UI.toast("Reminder Error: " + err.message, "error");
    }
  };
}

const actStatusBtn = el("actUpdateStatus");
if (actStatusBtn) {
  actStatusBtn.onclick = () => {
    const sel = el("caseStatusSelect");
    if (sel) sel.focus();
    else openEditCaseModal();
  };
}

function triggerInlineRowUpload(reqId, reqLabel) {
  openAgentUploadModal(reqId);
}

// --- AGENT UPLOAD MODAL LOGIC ---
function openAgentUploadModal(preselectedReqId) {
  if (!currentCase) return;
  const backdrop = el("agentUploadModalBackdrop");
  const select = el("agentUploadDocSelect");
  const errBox = el("agentUploadError");

  if (errBox) errBox.hidden = true;
  if (select) {
    select.innerHTML = "";
    const reqs = currentCase.docRequirements || [];
    if (reqs.length === 0) {
      UI.toast("No document requirements exist for this case yet.", "warning");
      return;
    }

    reqs.forEach(r => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `${r.label || r.type} (${r.status === 'received' ? 'Received' : 'Pending'})`;
      if (preselectedReqId && r.id === preselectedReqId) {
        opt.selected = true;
      }
      select.appendChild(opt);
    });
    if (preselectedReqId) select.value = preselectedReqId;
    UI.replaceSelect(select);
  }

  const fileInput = el("agentUploadFileInput");
  if (fileInput) fileInput.value = "";
  const labelInput = el("agentUploadLabelInput");
  if (labelInput) labelInput.value = "";
  if (backdrop) backdrop.hidden = false;
}

function closeAgentUploadModal() {
  const backdrop = el("agentUploadModalBackdrop");
  if (backdrop) backdrop.hidden = true;
}

const actUploadDocBtn = el("actUploadDoc");
if (actUploadDocBtn) actUploadDocBtn.onclick = () => openAgentUploadModal();

// --- REQUEST NEW DOCUMENT TYPE MODAL LOGIC ---
function openAddRequirementModal() {
  if (!currentCase) return;
  const backdrop = el("addRequirementModalBackdrop");
  const input = el("addRequirementInput");
  const errBox = el("addRequirementError");
  if (errBox) errBox.hidden = true;
  if (input) input.value = "";
  if (backdrop) backdrop.hidden = false;
}

function closeAddRequirementModal() {
  const backdrop = el("addRequirementModalBackdrop");
  if (backdrop) backdrop.hidden = true;
}

const addDocReqBtn = el("addDocRequirementBtn");
if (addDocReqBtn) addDocReqBtn.onclick = openAddRequirementModal;

const closeAddReqBtn = el("closeAddRequirement");
if (closeAddReqBtn) closeAddReqBtn.onclick = closeAddRequirementModal;

const cancelAddReqBtn = el("cancelAddRequirement");
if (cancelAddReqBtn) cancelAddReqBtn.onclick = closeAddRequirementModal;

const addReqForm = el("addRequirementForm");
if (addReqForm) {
  addReqForm.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentCase) return;
    const input = el("addRequirementInput");
    const errBox = el("addRequirementError");
    const submitBtn = el("submitAddRequirement");
    if (errBox) errBox.hidden = true;

    const label = input.value.trim();
    if (!label) return;

    submitBtn.disabled = true;
    submitBtn.textContent = "Adding...";
    try {
      const res = await authFetch(`/api/cases/${currentCase.id}/add-requirement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add requirement");

      UI.toast(`Requested new document: ${label}`, "success");
      closeAddRequirementModal();
      await loadCaseDetails(currentCase.id);
      loadTimeline(currentCase.id);
    } catch (err) {
      if (errBox) {
        errBox.textContent = err.message;
        errBox.hidden = false;
      } else {
        UI.toast("Error: " + err.message, "error");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Request Document";
    }
  };
}

const closeAgentUploadBtn = el("closeAgentUpload");
if (closeAgentUploadBtn) closeAgentUploadBtn.onclick = closeAgentUploadModal;

const cancelAgentUploadBtn = el("cancelAgentUpload");
if (cancelAgentUploadBtn) cancelAgentUploadBtn.onclick = closeAgentUploadModal;

const agentUploadFormEl = el("agentUploadForm");
if (agentUploadFormEl) {
  agentUploadFormEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentCase) return;
    const submitBtn = el("submitAgentUpload");
    const errBox = el("agentUploadError");
    if (errBox) errBox.hidden = true;

  const requiredDocId = el("agentUploadDocSelect").value;
  const fileInput = el("agentUploadFileInput");
  const fileLabel = el("agentUploadLabelInput").value.trim();

  if (!fileInput.files || fileInput.files.length === 0) {
    errBox.textContent = "Please select a file to upload.";
    errBox.hidden = false;
    return;
  }

  const file = fileInput.files[0];
  submitBtn.disabled = true;
  submitBtn.textContent = "Uploading...";

  try {
    // 1. Get presigned R2 upload URL
    const urlRes = await authFetch(`/api/cases/${currentCase.id}/agent-upload-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requiredDocId,
        contentType: file.type || "application/octet-stream",
        fileLabel: fileLabel || file.name
      })
    });
    const urlData = await urlRes.json();
    if (!urlRes.ok) throw new Error(urlData.error || "Failed to generate upload URL");

    // 2. Upload directly to R2 via PUT
    const putRes = await fetch(urlData.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type || "application/octet-stream" },
      body: file
    });
    if (!putRes.ok) throw new Error("Failed to upload file to storage.");

    // 3. Confirm completion & trigger OCR
    const completeRes = await authFetch(`/api/cases/${currentCase.id}/agent-upload-complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uploadId: urlData.uploadId })
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok) throw new Error(completeData.error || "Failed to confirm upload completion");

    closeAgentUploadModal();
    await init();
    UI.toast("Document uploaded successfully!", "success");
  } catch (err) {
    errBox.textContent = "Upload Error: " + err.message;
    errBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Upload Document";
  }
  };
}

// Copy Upload Link Action
async function handleCopyUploadLink() {
  if (!currentCase || !currentCase.token) {
    UI.toast("No active upload link token found for this case.", "warning");
    return;
  }
  const uploadUrl = `${window.location.origin}/upload.html?t=${currentCase.token}`;
  try {
    await navigator.clipboard.writeText(uploadUrl);
    UI.toast("Upload link copied to clipboard!", "success");
    
    const bannerCopyBtn = el("copyLinkBtn");
    if (bannerCopyBtn) {
      const origText = bannerCopyBtn.textContent;
      bannerCopyBtn.textContent = "✓ Copied!";
      setTimeout(() => { bannerCopyBtn.textContent = origText; }, 2500);
    }
  } catch (err) {
    await UI.prompt({
      title: "Client Upload Link",
      message: "Copy client upload link below:",
      defaultValue: uploadUrl
    });
  }
}

const bannerCopyBtn = el("copyLinkBtn");
if (bannerCopyBtn) bannerCopyBtn.onclick = handleCopyUploadLink;

const actCopyLinkBtn = el("actCopyLink");
if (actCopyLinkBtn) actCopyLinkBtn.onclick = handleCopyUploadLink;

// --- EDIT CASE MODAL LOGIC ---
async function openEditCaseModal() {
  if (!currentCase) return;
  const backdrop = el("editCaseModalBackdrop");
  const errBox = el("editCaseError");
  errBox.hidden = true;

  el("editContactPerson").value = currentCase.contactPerson || "";
  let phoneStr = String(currentCase.phone || "");
  if (phoneStr.startsWith("91") && phoneStr.length === 12) phoneStr = phoneStr.slice(2);
  el("editPhone").value = phoneStr;
  el("editAmountRequired").value = currentCase.amountRequired || "";

  // Fetch loan products & catalog
  try {
    const [pRes, cRes] = await Promise.all([
      authFetch("/api/loan-products"),
      authFetch("/api/document-catalog")
    ]);
    const pData = await pRes.json();
    const cData = await cRes.json();

    const productSel = el("editLoanProductSelect");
    productSel.innerHTML = "";
    (pData.loanProducts || []).forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.label;
      opt.textContent = p.label;
      if (p.label === currentCase.loanProduct) opt.selected = true;
      productSel.appendChild(opt);
    });
    UI.replaceSelect(productSel);

    const catalogGrid = el("editRequiredDocsFields");
    catalogGrid.innerHTML = "";
    const existingTypes = new Set((currentCase.docRequirements || []).map(r => r.type));

    (cData.documentCatalog || []).forEach(item => {
      const isChecked = existingTypes.has(item.id);
      const div = document.createElement("div");
      div.innerHTML = `
        <label style="font-size: 13px; color: #171717; display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
          <input type="checkbox" name="editDocRequirement" value="${item.id}" ${isChecked ? 'checked' : ''} />
          ${escapeHtml(item.label)}
        </label>
      `;
      catalogGrid.appendChild(div);
    });
  } catch (err) {
    console.error("Failed to load options for edit modal", err);
  }

  backdrop.hidden = false;
}

function closeEditCaseModal() {
  el("editCaseModalBackdrop").hidden = true;
}

const editCaseBtnEl = el("editCaseBtn");
if (editCaseBtnEl) editCaseBtnEl.onclick = openEditCaseModal;

const closeEditCaseBtn = el("closeEditCase");
if (closeEditCaseBtn) closeEditCaseBtn.onclick = closeEditCaseModal;

const cancelEditCaseBtn = el("cancelEditCase");
if (cancelEditCaseBtn) cancelEditCaseBtn.onclick = closeEditCaseModal;

const editCaseFormEl = el("editCaseForm");
if (editCaseFormEl) {
  editCaseFormEl.onsubmit = async (e) => {
    e.preventDefault();
    if (!currentCase) return;
    const submitBtn = el("submitEditCase");
    const errBox = el("editCaseError");
    if (errBox) errBox.hidden = true;

  const contactPerson = el("editContactPerson").value.trim();
  const phone = el("editPhone").value.trim();
  const loanProduct = el("editLoanProductSelect").value;
  const amountRequired = el("editAmountRequired").value;

  const checkboxes = document.querySelectorAll('input[name="editDocRequirement"]:checked');
  const requiredDocIds = Array.from(checkboxes).map(cb => cb.value);

  submitBtn.disabled = true;
  submitBtn.textContent = "Saving...";

  try {
    const res = await authFetch(`/api/cases/${currentCase.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contactPerson,
        phone,
        loanProduct,
        amountRequired,
        requiredDocIds
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to update case");

    closeEditCaseModal();
    await init();
    UI.toast("Loan case updated successfully!", "success");
  } catch (err) {
    errBox.textContent = "Error: " + err.message;
    errBox.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Changes";
  }
  };
}

function escapeHtml(str) {
  return (str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

function startApp() {
  updateUserProfileUI();

  const closePreviewBtn = el("closeDocPreview");
  if (closePreviewBtn) closePreviewBtn.onclick = closeDocumentPreview;

  const previewBackdrop = el("docPreviewBackdrop");
  if (previewBackdrop) {
    previewBackdrop.onclick = (e) => {
      if (e.target === previewBackdrop) closeDocumentPreview();
    };
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeDocumentPreview();
      closeAgentUploadModal();
      closeEditCaseModal();
    }
  });

  init().catch(err => {
    console.error("Initialization error:", err);
    const errBox = el("caseError");
    if (errBox) {
      errBox.textContent = "Initialization error: " + err.message;
      errBox.hidden = false;
    }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}


