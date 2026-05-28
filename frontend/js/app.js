let allLeads = [];
      let statusFilter = "all";
      let currentSort = "created"; 
      let documentCatalog = [];
      /** `null` = add lead; number = PATCH /api/leads/:rowIndex */
      let editingDbId = null;
      /** Lead row for “Log follow-up” modal */
      let followUpLead = null;
      /** Auto-close after add-client success overlay */
      let addClientCloseTimer = null;
      /** Bottom “add client” hint row — layout measurement */
      let tableGuideRaf = null;
      let tableGuideResizeTimer = null;
      const TABLE_GUIDE_COLS = 8;
      const TABLE_GUIDE_MIN_GAP_PX = 48;
      /** Brief celebration phase before success message */
      let addClientCelebrateTimer = null;
      const CELEBRATE_BEFORE_SUCCESS_MS = 900;

      const el = (id) => document.getElementById(id);

      function showBanner(type, message, timeoutMs) {
        const isError = type === "error";
        const target = isError ? el("error") : el("success");
        const other = isError ? el("success") : el("error");
        other.hidden = true;
        target.textContent = message;
        target.hidden = false;
        if (timeoutMs && timeoutMs > 0) {
          setTimeout(function () {
            target.hidden = true;
          }, timeoutMs);
        }
      }

      function setTableLoading(isLoading, isRefreshing) {
        const grid = el("leadsGrid");
        if (!grid) return;
        
        let loading = el("tableLoading");
        if (!loading) {
          loading = document.createElement("div");
          loading.id = "tableLoading";
          loading.className = "table-loading";
          loading.setAttribute("aria-live", "polite");
          grid.parentNode.insertBefore(loading, grid);
        }
        
        if (isLoading) {
          loading.textContent = isRefreshing ? "Refreshing clients..." : "Loading clients...";
          loading.hidden = false;
          grid.setAttribute("aria-busy", "true");
          return;
        }
        loading.hidden = true;
        grid.setAttribute("aria-busy", "false");
      }

      function clearAddClientCloseTimer() {
        if (addClientCloseTimer) {
          clearTimeout(addClientCloseTimer);
          addClientCloseTimer = null;
        }
      }

      function clearAddClientCelebrateTimer() {
        if (addClientCelebrateTimer) {
          clearTimeout(addClientCelebrateTimer);
          addClientCelebrateTimer = null;
        }
      }

      function resetModalAddOverlays() {
        clearAddClientCloseTimer();
        clearAddClientCelebrateTimer();
        el("modalAddLoading").hidden = true;
        el("modalAddCelebrate").hidden = true;
        el("modalAddSuccess").hidden = true;
        el("modalBackdrop").dataset.saving = "";
        el("closeModal").disabled = false;
        el("cancelAdd").disabled = false;
      }

      function showModalAddLoading() {
        el("modalError").hidden = true;
        el("modalAddSuccess").hidden = true;
        el("modalAddCelebrate").hidden = true;
        el("modalAddLoading").hidden = false;
        el("modalBackdrop").dataset.saving = "1";
        el("closeModal").disabled = true;
        el("cancelAdd").disabled = true;
      }

      function hideModalAddLoading() {
        el("modalAddLoading").hidden = true;
        el("modalBackdrop").dataset.saving = "";
        el("closeModal").disabled = false;
        el("cancelAdd").disabled = false;
      }

      function showModalAddCelebrate() {
        el("modalAddLoading").hidden = true;
        el("modalAddSuccess").hidden = true;
        el("modalAddCelebrate").hidden = false;
        el("modalBackdrop").dataset.saving = "1";
        el("closeModal").disabled = true;
        el("cancelAdd").disabled = true;
      }

      function showModalAddSuccess() {
        el("modalAddLoading").hidden = true;
        el("modalAddCelebrate").hidden = true;
        el("modalAddSuccess").hidden = false;
        el("modalBackdrop").dataset.saving = "";
        el("closeModal").disabled = false;
        el("cancelAdd").disabled = false;
      }

      /** Open row ⋮ menu (fixed dropdown); cleared on outside click, Escape, scroll, resize. */
      let rowMenuDropdownEl = null;

function openRowMenu(lead, triggerBtn) {
  closeRowMenu();

  const menu = document.createElement("div");
  menu.className = "row-menu-dropdown";
  menu.setAttribute("role", "menu");
  
  // Copy Link
  const copyLinkItem = document.createElement("button");
  copyLinkItem.className = "row-menu-item";
  copyLinkItem.setAttribute("role", "menuitem");
  copyLinkItem.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Copy link';
  
  if (!lead.token) {
    copyLinkItem.disabled = true;
    copyLinkItem.title = "Portal link unavailable";
  } else {
    copyLinkItem.onclick = function(e) {
      e.stopPropagation();
      closeRowMenu();
      const link = window.location.origin + "/upload.html?t=" + lead.token;
      navigator.clipboard.writeText(link).then(() => {
        showBanner("Link copied to clipboard!");
      });
    };
  }

  // Delete
  const delItem = document.createElement("button");
  delItem.className = "row-menu-item item-danger";
  delItem.setAttribute("role", "menuitem");
  delItem.innerHTML = '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Delete';
  delItem.onclick = function (e) {
    e.stopPropagation();
    closeRowMenu();
    openDeleteLeadModal(lead);
  };

  menu.appendChild(copyLinkItem);
  menu.appendChild(delItem);

  document.body.appendChild(menu);

  const rect = triggerBtn.getBoundingClientRect();
  menu.style.position = "fixed";
  menu.style.top = rect.bottom + 4 + "px";
  
  // Align to the right edge of the trigger button
  const menuWidth = 160; 
  menu.style.left = Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 10) + "px";

  rowMenuDropdownEl = menu;
  rowMenuDropdownEl._menuTrigger = triggerBtn;
  triggerBtn.setAttribute("aria-expanded", "true");
}


      function closeRowMenu() {
        if (rowMenuDropdownEl) {
          rowMenuDropdownEl.hidden = true;
          if (rowMenuDropdownEl._menuTrigger) {
            rowMenuDropdownEl._menuTrigger.setAttribute("aria-expanded", "false");
          }
          rowMenuDropdownEl = null;
        }
      }

      

      function formatWhen(iso) {
        if (!iso) return "—";
        try {
          const d = new Date(iso);
          if (Number.isNaN(d.getTime())) return "—";
          return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        } catch {
          return "—";
        }
      }

      /** Relative time from sheet Last updated (ISO), for “last interaction”-style display. */
      function formatLastActivityLine(iso) {
        if (!iso) return "—";
        let t;
        try {
          t = new Date(iso).getTime();
        } catch {
          return "—";
        }
        if (Number.isNaN(t)) return "—";
        const sec = Math.floor((Date.now() - t) / 1000);
        if (sec < 60) return "Just now";
        const min = Math.floor(sec / 60);
        if (min < 60) {
          return min === 1 ? "1 minute ago" : min + " minutes ago";
        }
        const hr = Math.floor(min / 60);
        if (hr < 24) {
          return hr === 1 ? "About 1 hour ago" : "About " + hr + " hours ago";
        }
        const day = Math.floor(hr / 24);
        if (day < 30) {
          return day === 1 ? "1 day ago" : day + " days ago";
        }
        const month = Math.floor(day / 30);
        if (month < 12) {
          return month === 1 ? "1 month ago" : month + " months ago";
        }
        const yr = Math.floor(month / 12);
        return yr === 1 ? "1 year ago" : yr + " years ago";
      }

      function docStatusBadge(status) {
        const span = document.createElement("span");
        if (status === "received") {
          span.className = "doc doc-yes";
          span.textContent = "Received";
        } else if (status === "flagged") {
          span.className = "doc doc-flagged";
          span.textContent = "Flagged";
        } else if (status === "failed") {
          span.className = "doc doc-failed";
          span.textContent = "Failed";
        } else {
          span.className = "doc doc-no";
          span.textContent = "Not received";
        }
        return span;
      }

      function buildOcrPreview(entry) {
        const ocr = entry && entry.ocr ? entry.ocr : null;
        if (!ocr || typeof ocr !== "object") {
          if (entry && entry.status === "received") {
            const wrap = document.createElement("div");
            wrap.className = "doc-ocr-preview cell-muted";
            wrap.style.fontStyle = "italic";
            wrap.textContent = "AI is currently extracting data from this document...";
            return wrap;
          }
          if (entry && entry.status === "failed") {
            const wrap = document.createElement("div");
            wrap.className = "doc-ocr-preview cell-muted";
            wrap.style.color = "var(--danger)";
            wrap.textContent = "AI data extraction failed. Please request resubmission.";
            return wrap;
          }
          return null;
        }
        const wrap = document.createElement("div");
        wrap.className = "doc-ocr-preview cell-muted";
        
        const tokens = [];
        let statementStart = "";
        let statementEnd = "";

        // Flatten or iterate the object keys
        const extractTokens = (obj) => {
          for (const [key, value] of Object.entries(obj)) {
            if (value && typeof value === 'object') {
              extractTokens(value); // Recursively extract nested fields if Gemini nested them
            } else if (value && typeof value !== 'function') {
              const lowerKey = key.toLowerCase();
              if (lowerKey === 'statementperiodstart' || lowerKey === 'statement_period_start') {
                statementStart = value;
              } else if (lowerKey === 'statementperiodend' || lowerKey === 'statement_period_end') {
                statementEnd = value;
              } else if (lowerKey === 'documenttype' || lowerKey === 'document_type') {
                // Ignore document type in preview
              } else {
                // Convert camelCase/snake_case keys to Title Case for display
                const label = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^./, str => str.toUpperCase());
                tokens.push(`${label}: ${value}`);
              }
            }
          }
        };

        extractTokens(ocr);

        if (statementStart || statementEnd) {
          tokens.unshift(`From ${statementStart || '?'} to ${statementEnd || '?'}`);
        }

        const text = tokens.length > 0 ? tokens.join(" | ") : "OCR processed";
        const sparkleSvg = '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0; color: var(--accent);"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>';
        
        wrap.style.display = "inline-flex";
        wrap.style.alignItems = "flex-start";
        wrap.style.gap = "0.35rem";
        wrap.style.padding = "0.5rem 0.75rem";
        wrap.style.borderRadius = "var(--radius-sm)";
        wrap.style.border = "1px solid #16a34a";
        wrap.style.backgroundColor = "var(--neutral-bg)";
        
        // If it's flagged, format it as requested
        if (entry.status === 'flagged' || ocr.anomaly) {
          const reason = ocr.anomalyReason || ocr.anomaly_reason || ocr.anomalyReason || "Flagged for manual review.";
          wrap.style.color = "var(--accent)";
          wrap.style.border = "1px solid #ea580c";
          wrap.style.backgroundColor = "var(--surface)";
          
          const textSpan = document.createElement("span");
          textSpan.textContent = reason;
          wrap.innerHTML = sparkleSvg;
          wrap.appendChild(textSpan);
          return wrap;
        }
        
        const textSpan = document.createElement("span");
        textSpan.textContent = text;
        
        wrap.innerHTML = sparkleSvg;
        wrap.appendChild(textSpan);
        
        return wrap;
      }

      function labelForDocId(id) {
        const m = String(id).match(/^bank_statement_(\d+)$/);
        if (m) return "Bank statement (" + m[1] + ")";
        const it = documentCatalog.find(function (x) {
          return x.id === id;
        });
        return it ? it.label : id;
      }

      function inferBankStatementCount(ids) {
        let maxN = 0;
        const arr = ids || [];
        for (let i = 0; i < arr.length; i++) {
          const mm = String(arr[i]).match(/^bank_statement_(\d+)$/);
          if (mm) {
            const n = parseInt(mm[1], 10);
            if (!Number.isNaN(n)) maxN = Math.max(maxN, n);
          }
        }
        return maxN;
      }

      function formatRequiredDocLabels(ids) {
        if (!ids || !ids.length) return "—";
        return ids.map(labelForDocId).join(", ");
      }

      function buildRequiredDocsCheckboxes() {
        const root = el("requiredDocsFields");
        root.innerHTML = "";
        for (const item of documentCatalog) {
          if (item.allowMultiple) {
            const wrap = document.createElement("div");
            wrap.className = "doc-check doc-check--multi";
            const lab = document.createElement("label");
            lab.className = "doc-check doc-check-inline";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.setAttribute("data-doc-multibase", item.id);
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(item.label));
            const num = document.createElement("input");
            num.type = "number";
            num.className = "doc-count-input";
            num.min = "1";
            num.max = String(item.maxCount != null ? item.maxCount : 10);
            num.value = "1";
            num.setAttribute("aria-label", "How many " + item.label + " to collect");
            num.disabled = true;
            num.addEventListener("click", function (ev) {
              ev.stopPropagation();
            });
            wrap.appendChild(lab);
            wrap.appendChild(num);
            cb.addEventListener("change", function () {
              num.disabled = !cb.checked;
            });
            root.appendChild(wrap);
          } else {
            const lab = document.createElement("label");
            lab.className = "doc-check";
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = item.id;
            cb.setAttribute("data-doc-id", item.id);
            lab.appendChild(cb);
            lab.appendChild(document.createTextNode(item.label));
            root.appendChild(lab);
          }
        }
      }

      function setDefaultRequiredChecks() {
        el("requiredDocsFields").querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
          if (cb.hasAttribute("data-doc-multibase")) {
            cb.checked = false;
          } else {
            cb.checked = cb.value === "pan";
          }
        });
        el("requiredDocsFields").querySelectorAll(".doc-count-input").forEach(function (inp) {
          const wrap = inp.closest(".doc-check--multi");
          const cbx = wrap && wrap.querySelector("[data-doc-multibase]");
          if (inp.value === "" || inp.value === "0") inp.value = "1";
          inp.disabled = !cbx || !cbx.checked;
        });
      }

      

      

      

      

      

      

      

      function formatRequiredDocLabels(ids) {
  if (!ids || !ids.length) return "—";
  return ids.map(labelForDocId).join(", ");
}

function getInitials(name) {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return "#f1f5f9";
  const colors = [
    { bg: "#fee2e2", color: "#b91c1c" }, // red
    { bg: "#ffedd5", color: "#c2410c" }, // orange
    { bg: "#fef3c7", color: "#b45309" }, // yellow
    { bg: "#dcfce7", color: "#15803d" }, // green
    { bg: "#e0e7ff", color: "#4338ca" }, // indigo
    { bg: "#f3e8ff", color: "#7e22ce" }, // purple
    { bg: "#fce7f3", color: "#be185d" }, // pink
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return colors[hash % colors.length];
}

function render() {
  const grid = el("leadsGrid");
  const empty = el("empty");
  const rows = visibleLeads();
  grid.innerHTML = "";

  if (rows.length === 0) {
    empty.hidden = false;
    if (allLeads.length === 0) {
      el("emptyTitle").textContent = "No clients yet.";
      el("emptyDesc").textContent =
        "Use “Create” above to add a new client.";
    } else if (statusFilter === "followup") {
      el("emptyTitle").textContent = "No follow-ups due";
      el("emptyDesc").textContent =
        "Everyone is either complete or was contacted recently. Open Filter and choose All to see everyone.";
    } else {
      el("emptyTitle").textContent = "No rows match";
      el("emptyDesc").textContent =
        "Try another name or phone, or open Filter to change status.";
    }
    return;
  }

  empty.hidden = true;

  for (let i = 0; i < rows.length; i++) {
    const lead = rows[i];
    grid.appendChild(buildLeadCard(lead));
  }
}

function buildLeadCard(lead) {
  const card = document.createElement("div");
  card.className = "lead-card";
  
  card.appendChild(buildCol1Client(lead));
  card.appendChild(buildCol2Docs(lead));
  card.appendChild(buildCol3Status(lead));
  card.appendChild(buildCol5Actions(lead));
  
  return card;
}

function buildCol1Client(lead) {
  const col = document.createElement("div");
  col.className = "card-col col-client";
  
  // Header: Avatar + Info
  const header = document.createElement("div");
  header.className = "client-header";
  
  const avatar = document.createElement("div");
  avatar.className = "client-avatar";
  const initials = getInitials(lead.name);
  const colorSchema = getAvatarColor(lead.name);
  avatar.style.backgroundColor = colorSchema.bg;
  avatar.style.color = colorSchema.color;
  avatar.textContent = initials;
  
  const info = document.createElement("div");
  info.className = "client-info";
  
  const nameEl = document.createElement("div");
  nameEl.className = "client-name";
  nameEl.textContent = lead.name || "—";
  
  const phoneEl = document.createElement("div");
  phoneEl.className = "client-phone";
  const displayPhone = (lead.phone && lead.phone.length === 12 && lead.phone.startsWith("91")) ? lead.phone.substring(2) : (lead.phone || "—");
  phoneEl.textContent = displayPhone;
  
  info.appendChild(nameEl);
  info.appendChild(phoneEl);
  
  header.appendChild(avatar);
  header.appendChild(info);
  col.appendChild(header);
  
  // Progress
  const progressSec = document.createElement("div");
  progressSec.className = "client-progress-section";
  
  const progHeading = document.createElement("div");
  progHeading.className = "col-heading";
  progHeading.textContent = "Progress";
  
  const reqCount = (lead.requiredDocIds || []).length;
  const state = lead.documentsState || {};
  let rcvCount = 0;
  if (reqCount > 0) {
    for (const id of lead.requiredDocIds) {
      if (state[id] && state[id].status === "received") rcvCount++;
    }
  }
  let pct = reqCount === 0 ? 100 : Math.round((rcvCount / reqCount) * 100);
  
  const pctEl = document.createElement("div");
  pctEl.className = "progress-pct";
  pctEl.textContent = pct + "% Complete";
  if (pct === 100) {
    pctEl.style.color = "var(--success-text)";
  } else if (pct === 0) {
    pctEl.style.color = "#c2410c"; // orange-red
  }
  
  const track = document.createElement("div");
  track.className = "progress-track";
  const fill = document.createElement("div");
  fill.className = "progress-fill";
  fill.style.width = pct + "%";
  if (pct === 100) {
    fill.style.backgroundColor = "var(--success-text)";
  } else if (pct === 0) {
    fill.style.width = "0%";
  }
  track.appendChild(fill);
  
  const docText = document.createElement("div");
  docText.className = "progress-text";
  docText.textContent = reqCount === 1 
    ? rcvCount + " / " + reqCount + " document received"
    : rcvCount + " / " + reqCount + " documents received";
  
  progressSec.appendChild(progHeading);
  progressSec.appendChild(pctEl);
  progressSec.appendChild(track);
  progressSec.appendChild(docText);
  col.appendChild(progressSec);
  
  return col;
}

function buildCol2Docs(lead) {
  const col = document.createElement("div");
  col.className = "card-col col-docs";
  
  const ids = lead.requiredDocIds || [];
  const reqCount = ids.length;
  
  const heading = document.createElement("div");
  heading.className = "col-heading";
  heading.textContent = reqCount === 1 ? "Documents (1 required)" : "Documents (" + reqCount + " required)";
  col.appendChild(heading);
  
  const state = lead.documentsState || {};
  
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const entry = state[id] || {};
    const st = entry.status || "pending";
    const link = typeof entry.link === "string" ? entry.link : "";
    
    const row = document.createElement("div");
    row.className = "doc-item-row";
    
    const topRow = document.createElement("div");
    topRow.className = "doc-item-top";
    
    // Icon + Label
    const mainArea = document.createElement("div");
    mainArea.className = "doc-item-main";
    
    const iconWrapper = document.createElement("div");
    iconWrapper.className = "doc-item-icon";
    if (st === "received") {
      iconWrapper.classList.add("received");
      iconWrapper.innerHTML = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 4L12 14.01l-3-3"/></svg>';
    } else if (st === "flagged") {
      iconWrapper.classList.add("flagged");
      iconWrapper.innerHTML = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
      iconWrapper.style.color = "#ea580c";
    } else {
      iconWrapper.innerHTML = '<svg viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="14 2 14 8 20 8"/></svg>';
    }
    
    const labelWrapper = document.createElement("div");
    labelWrapper.className = "doc-item-label-wrap";
    
    const lab = document.createElement("span");
    lab.className = "doc-item-label";
    lab.textContent = labelForDocId(id);
    labelWrapper.appendChild(lab);
    
    mainArea.appendChild(iconWrapper);
    mainArea.appendChild(labelWrapper);
    
    // Pills
    const pillsArea = document.createElement("div");
    pillsArea.className = "doc-item-pills";
    
    if (st === "received" && link) {
      const viewBtn = document.createElement("button");
      viewBtn.type = "button";
      viewBtn.className = "btn-stack btn-stack-outline";
      viewBtn.style.padding = "2px 8px";
      viewBtn.style.fontSize = "0.75rem";
      viewBtn.innerHTML = 'View File';
      viewBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(link, "_blank");
      };
      pillsArea.appendChild(viewBtn);
    } else {
      if (st !== "flagged") {
        pillsArea.appendChild(docStatusBadge(st));
      }
      if (st === "flagged" && link) {
        const viewBtn = document.createElement("button");
        viewBtn.type = "button";
        viewBtn.className = "btn-stack btn-stack-outline";
        viewBtn.style.padding = "2px 8px";
        viewBtn.style.fontSize = "0.75rem";
        viewBtn.innerHTML = 'View File';
        viewBtn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.open(link, "_blank");
        };
        pillsArea.appendChild(viewBtn);
      }
    }
    
    if (st === "flagged" || st === "failed" || (st === "received" && String(id).startsWith("bank_statement"))) {
      const rejectBtn = document.createElement("button");
      rejectBtn.className = "btn-reject";
      rejectBtn.textContent = "Reject";
      rejectBtn.onclick = () => rejectDocument(lead.dbId, id);
      pillsArea.appendChild(rejectBtn);
    }
    
    topRow.appendChild(mainArea);
    topRow.appendChild(pillsArea);
    row.appendChild(topRow);
    
    const ocrPreview = buildOcrPreview(entry);
    if (ocrPreview) {
      ocrPreview.className = "doc-item-ocr-preview";
      row.appendChild(ocrPreview);
    }
    
    col.appendChild(row);
  }
  
  return col;
}

function buildCol3Status(lead) {
  const col = document.createElement("div");
  col.className = "card-col col-status";
  
  const heading = document.createElement("div");
  heading.className = "col-heading";
  heading.textContent = "Status";
  col.appendChild(heading);
  
  const badgeWrapper = document.createElement("div");
  badgeWrapper.style.marginBottom = "0.75rem";
  
  const isDone = lead.status === "Completed";
  
  const badge = document.createElement("span");
  badge.className = "status-pill " + (isDone ? "status-done" : "status-progress");
  
  if (isDone) {
    badge.innerHTML = '<svg class="status-icon" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg> Completed';
  } else {
    badge.innerHTML = '<svg class="status-icon" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"/></svg> In progress';
  }
  
  badgeWrapper.appendChild(badge);
  col.appendChild(badgeWrapper);
  
  const lastAct = document.createElement("div");
  lastAct.style.marginTop = "0.75rem";
  lastAct.style.fontSize = "0.75rem";
  lastAct.style.color = "var(--muted)";
  lastAct.style.fontWeight = "500";
  lastAct.textContent = "Last Activity: " + getRelativeTime(lead.lastUpdated || lead.createdAt || new Date().toISOString());
  col.appendChild(lastAct);

  // If WhatsApp delivery failed, show a prominent failure message and copy link CTA
  if (lead.whatsappDeliveryStatus === "failed") {
    const waError = document.createElement("div");
    waError.style.marginTop = "0.5rem";
    waError.style.fontSize = "0.75rem";
    waError.style.color = "#dc2626"; // red
    waError.style.fontWeight = "600";
    waError.innerHTML = `⚠️ WhatsApp Delivery Failed`;
    col.appendChild(waError);

    if (lead.token) {
      const cta = document.createElement("button");
      cta.className = "btn-stack btn-stack-outline";
      cta.style.marginTop = "0.4rem";
      cta.style.fontSize = "0.7rem";
      cta.style.padding = "4px 8px";
      cta.style.height = "auto";
      cta.style.borderColor = "#fecaca"; // soft red border
      cta.style.color = "#b91c1c"; // red text
      cta.style.backgroundColor = "#fef2f2"; // soft red bg
      cta.style.display = "inline-flex";
      cta.style.alignItems = "center";
      cta.style.gap = "4px";
      cta.style.transition = "all 0.2s ease";
      
      cta.onmouseover = () => {
        cta.style.backgroundColor = "#fee2e2";
        cta.style.borderColor = "#fca5a5";
      };
      cta.onmouseout = () => {
        cta.style.backgroundColor = "#fef2f2";
        cta.style.borderColor = "#fecaca";
      };

      cta.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Copy manual link`;
      
      cta.onclick = function(e) {
        e.preventDefault();
        const link = window.location.origin + "/upload.html?t=" + lead.token;
        navigator.clipboard.writeText(link).then(() => {
          cta.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/></svg> Copied!`;
          cta.style.backgroundColor = "#dcfce7"; // soft green bg
          cta.style.borderColor = "#bbf7d0";
          cta.style.color = "#15803d";
          setTimeout(() => {
            cta.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg> Copy manual link`;
            cta.style.backgroundColor = "#fef2f2";
            cta.style.borderColor = "#fecaca";
            cta.style.color = "#b91c1c";
          }, 2000);
        });
      };
      col.appendChild(cta);
    }
  }
  
  return col;
}

function getRelativeTime(isoString) {
  if (!isoString) return "Recently";
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 60000) return "Just now";
  
  const mins = Math.floor(diffMs / 60000);
  if (mins < 60) return mins + "m ago";
  
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + "h ago";
  
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  return days + "d ago";
}

function buildCol5Actions(lead) {
  const col = document.createElement("div");
  col.className = "card-col col-actions";
  
  const heading = document.createElement("div");
  heading.className = "col-heading";
  heading.textContent = "Actions";
  col.appendChild(heading);
  
  const actionsWrap = document.createElement("div");
  actionsWrap.className = "actions-stack";
  
  // Send Follow-up button (always present, but maybe disabled if completed or too soon)
  const isDone = lead.status === "Completed";
  
  const lastUpdatedMs = lead.lastUpdated ? new Date(lead.lastUpdated).getTime() : new Date(lead.createdAt || Date.now()).getTime();
  const minutesSinceLastUpdate = (Date.now() - lastUpdatedMs) / (1000 * 60);
  const tooSoon = minutesSinceLastUpdate < 10;
  
  const fuBtn = document.createElement("button");
  fuBtn.className = "btn-stack btn-stack-primary";
  fuBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m22 2-7 20-4-9-9-4Z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M22 2 11 13"/></svg> Send Follow-up';
  
  if (isDone) {
    fuBtn.disabled = true;
    fuBtn.title = "Workflow completed, no follow-up needed.";
    fuBtn.style.opacity = "0.5";
    fuBtn.style.cursor = "not-allowed";
  } else if (tooSoon) {
    fuBtn.disabled = true;
    fuBtn.title = "Please wait 10 minutes since the last activity before sending another follow-up.";
    fuBtn.style.opacity = "0.5";
    fuBtn.style.cursor = "not-allowed";
  } else {
    fuBtn.onclick = function () {
      openFollowUpModal(lead);
    };
  }
  actionsWrap.appendChild(fuBtn);
  
  // Add Document button
  const addDocBtn = document.createElement("button");
  addDocBtn.className = "btn-stack btn-stack-outline";
  addDocBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg> Add Document';
  addDocBtn.onclick = function() {
    openEditLead(lead);
  };
  actionsWrap.appendChild(addDocBtn);
  
  // Note: View File button removed completely as requested. Users use the doc links in Column 2.
  
  // Menu button (three dots)
  const menuBtn = document.createElement("button");
  menuBtn.className = "btn-stack btn-stack-icon";
  menuBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>';
  menuBtn.onclick = function(ev) {
    ev.stopPropagation();
    openRowMenu(lead, menuBtn);
  };
  actionsWrap.appendChild(menuBtn);
  
  col.appendChild(actionsWrap);
  return col;
}


      function matchesSearch(lead, q) {
        if (!q) return true;
        const phone = String(lead.phone || "").toLowerCase();
        const name = String(lead.name || "").toLowerCase();
        return phone.includes(q) || name.includes(q);
      }

      function visibleLeads() {
        let list = [...allLeads];
        const q = el("q").value.trim().toLowerCase();
        
        // Filter
        list = list.filter((l) => {
          if (statusFilter === "followup") {
            if (!l.needsFollowUp) return false;
          } else if (statusFilter !== "all" && l.status !== statusFilter) {
            return false;
          }
          return matchesSearch(l, q);
        });

        // Sort
        list = list.sort((a, b) => {
          if (currentSort === "name") {
            return String(a.name || "").localeCompare(String(b.name || ""));
          } else if (currentSort === "progress") {
            const getProgress = (lead) => {
              const ids = lead.requiredDocIds || [];
              if (ids.length === 0) return 1;
              const state = lead.documentsState || {};
              let done = 0;
              for (const id of ids) {
                if (state[id] && state[id].status === "received") done++;
              }
              return done / ids.length;
            };
            return getProgress(b) - getProgress(a);
          } else if (currentSort === "status") {
            return String(a.status || "").localeCompare(String(b.status || ""));
          }
          return 0;
        });
        return list;
      }

      function setSummary(s) {
        s = s || {};
        const total = s.total || 0;
        const completed = s.completed || 0;
        const followUpDue = allLeads.filter(lead => {
          if (lead.status === "Completed") return false;
          const lastUpdatedMs = lead.lastUpdated ? new Date(lead.lastUpdated).getTime() : new Date(lead.createdAt || Date.now()).getTime();
          const minutesSinceLastUpdate = (Date.now() - lastUpdatedMs) / (1000 * 60);
          return minutesSinceLastUpdate >= 10;
        }).length;
        
        el("statTotal").textContent = total;
        el("statDone").textContent = completed;
        el("statFollowUp").textContent = followUpDue;
        
        const totalDocsRequired = allLeads.reduce(function (sum, lead) {
          return sum + ((lead.requiredDocIds && lead.requiredDocIds.length) || 0);
        }, 0);
        el("statDocs").textContent = totalDocsRequired;
      }

      function resetModalAddMode() {
        editingDbId = null;
        el("modalTitle").textContent = "Add client";
        el("newPhone").readOnly = false;
        el("newPhone").required = true;
        el("newName").readOnly = false;
        el("newName").required = true;
        el("submitAdd").textContent = "Add client";
        el("requiredDocsHint").textContent =
          "Select at least one document.";
      }

      async function openModalForAdd() {
        closeRowMenu();
        resetModalAddMode();
        resetModalAddOverlays();
        el("addForm").reset();
        el("modalBackdrop").hidden = false;
        el("modalError").hidden = true;
        el("modalError").textContent = "";
        if (!documentCatalog.length || el("requiredDocsFields").children.length === 0) {
          await loadDocumentCatalog();
        }
        if (documentCatalog.length) {
          if (el("requiredDocsFields").children.length === 0) {
            buildRequiredDocsCheckboxes();
          }
          setDefaultRequiredChecks();
          el("modalError").textContent = "";
          el("modalError").hidden = true;
        } else {
          el("modalError").textContent =
            "Could not load the document list. Check that the server is running and refresh the page.";
          el("modalError").hidden = false;
        }
        el("newName").focus();
      }

      async function openEditLead(lead) {
        closeRowMenu();
        editingDbId = lead.dbId || null;
        if (editingDbId === null) {
          return;
        }
        el("modalTitle").textContent = "Edit";
        el("submitAdd").textContent = "Save changes";
        el("newPhone").readOnly = false;
        el("newPhone").required = true;
        el("newName").readOnly = false;
        el("newName").required = true;
        el("newName").value = lead.name || "";
        const editPhone = (lead.phone && lead.phone.length === 12 && lead.phone.startsWith("91")) ? lead.phone.substring(2) : (lead.phone || "");
        el("newPhone").value = editPhone;
        el("requiredDocsHint").textContent =
          "Update name, phone, or required docs. Keep the phone aligned with WhatsApp if this person chats there.";
        el("modalError").hidden = true;
        el("modalError").textContent = "";
        resetModalAddOverlays();
        el("modalBackdrop").hidden = false;
        if (!documentCatalog.length || el("requiredDocsFields").children.length === 0) {
          await loadDocumentCatalog();
        }
        if (documentCatalog.length && el("requiredDocsFields").children.length === 0) {
          buildRequiredDocsCheckboxes();
        }
        const selected = new Set(lead.requiredDocIds || []);
        const bankN = inferBankStatementCount(lead.requiredDocIds || []);
        
        const docsState = lead.documentsState || {};
        const submittedMultiBases = new Set();
        const submittedSingleDocs = new Set();
        for (const [docId, entry] of Object.entries(docsState)) {
          if (entry.status !== 'pending') {
            const isMulti = docId.match(/_[0-9]+_[0-9]+$/);
            if (isMulti) {
              submittedMultiBases.add(docId.replace(/_[0-9]+_[0-9]+$/, ""));
            } else {
              submittedSingleDocs.add(docId);
            }
          }
        }
        
        el("requiredDocsFields").querySelectorAll("[data-doc-multibase]").forEach(function (cb) {
          const base = cb.getAttribute("data-doc-multibase");
          const isSubmitted = submittedMultiBases.has(base);
          if (base === "bank_statement") {
            cb.checked = bankN >= 1;
            const wrap = cb.closest(".doc-check--multi");
            const num = wrap && wrap.querySelector(".doc-count-input");
            if (num) {
              num.value = String(Math.max(1, bankN || 1));
              num.disabled = !cb.checked || isSubmitted;
            }
          }
          cb.disabled = isSubmitted;
        });
        el("requiredDocsFields")
          .querySelectorAll('input[type="checkbox"]:not([data-doc-multibase])')
          .forEach(function (cb) {
            cb.checked = selected.has(cb.value);
            cb.disabled = submittedSingleDocs.has(cb.value);
          });
        if (!documentCatalog.length) {
          el("modalError").textContent =
            "Could not load the document list. Check that the server is running and refresh the page.";
          el("modalError").hidden = false;
        }
        el("newName").focus();
      }

      function closeModal() {
        if (el("modalBackdrop").dataset.saving === "1") {
          return;
        }
        closeRowMenu();
        resetModalAddOverlays();
        el("submitAdd").disabled = false;
        el("modalBackdrop").hidden = true;
        el("addForm").reset();
        resetModalAddMode();
      }


      let leadToDeleteId = null;
      function openDeleteLeadModal(lead) {
        closeRowMenu();
        if (!lead.dbId) return;
        leadToDeleteId = lead.dbId;
        el("deleteModalBackdrop").hidden = false;
      }

      function closeDeleteModal() {
        el("deleteModalBackdrop").hidden = true;
        leadToDeleteId = null;
      }

      el("cancelDeleteBtn")?.addEventListener("click", closeDeleteModal);
      el("closeDeleteModalBtn")?.addEventListener("click", closeDeleteModal);

      el("confirmDeleteBtn")?.addEventListener("click", async () => {
        if (!leadToDeleteId) return;
        const btn = el("confirmDeleteBtn");
        btn.disabled = true;
        btn.textContent = "Deleting...";
        try {
          const res = await fetch("/api/leads/" + leadToDeleteId, {
            method: "DELETE"
          });
          if (!res.ok) throw new Error("Failed to delete");
          closeDeleteModal();
          load(); // refresh dashboard
        } catch (e) {
          alert("Error deleting lead.");
        } finally {
          btn.disabled = false;
          btn.textContent = "Delete";
        }
      });

      function openFollowUpModal(lead) {
        const ri = typeof lead.rowIndex === "number" && lead.rowIndex >= 0 ? lead.rowIndex : null;
        if (ri === null) {
          return;
        }
        followUpLead = lead;
        el("followUpError").hidden = true;
        el("followUpError").textContent = "";
        el("followUpNote").value = "";
        el("followUpSendWa").checked = true;
        const followUpPhone = (lead.phone && lead.phone.length === 12 && lead.phone.startsWith("91")) ? lead.phone.substring(2) : (lead.phone || "—");
        el("followUpClientLine").textContent =
          (lead.name || "Client") + " · " + followUpPhone;
        if (lead.status === "Completed") {
          el("followUpReminderPreview").textContent =
            "Short team check-in (client already marked complete).";
        } else {
          el("followUpReminderPreview").textContent = lead.dropOffReminder || "—";
        }
        el("followUpBackdrop").hidden = false;
        el("followUpNote").focus();
      }

      function closeFollowUpModal() {
        followUpLead = null;
        el("followUpBackdrop").hidden = true;
        el("followUpForm").reset();
        el("followUpError").hidden = true;
        el("followUpError").textContent = "";
      }

      async function loadDocumentCatalog() {
        try {
          const res = await fetch("/api/document-catalog");
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return;
          documentCatalog = data.documentCatalog || [];
          if (documentCatalog.length) {
            buildRequiredDocsCheckboxes();
            setDefaultRequiredChecks();
          }
        } catch (e) {
          console.error("Document catalog:", e);
        }
      }

      async function load() {
        const err = el("error");
        const succ = el("success");
        const btn = el("refreshBtn");
        const hasRenderedRows = allLeads.length > 0;
        err.hidden = true;
        succ.hidden = true;
        btn.disabled = true;
        setTableLoading(true, hasRenderedRows);
        try {
          await loadDocumentCatalog();

          const res = await fetch("/api/leads");
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.error || "Failed to load");

          allLeads = data.leads || [];
          if (Array.isArray(data.documentCatalog) && data.documentCatalog.length) {
            documentCatalog = data.documentCatalog;
            if (el("requiredDocsFields").children.length === 0) {
              buildRequiredDocsCheckboxes();
              setDefaultRequiredChecks();
            }
          }
          setSummary(
            data.summary || { total: 0, inProgress: 0, completed: 0, followUpDue: 0 },
          );

          render();
        } catch (e) {
          err.textContent = e.message || "Could not load data.";
          err.hidden = false;
        } finally {
          btn.disabled = false;
          setTableLoading(false, false);
        }
      }


      el("refreshBtn").addEventListener("click", function () {
        load();
      });

      let docToReject = null;

      function closeRejectModal() {
        el("rejectModalBackdrop").hidden = true;
        docToReject = null;
      }

      el("cancelRejectBtn")?.addEventListener("click", closeRejectModal);
      el("closeRejectModalBtn")?.addEventListener("click", closeRejectModal);

      el("confirmRejectBtn")?.addEventListener("click", async () => {
        if (!docToReject) return;
        const btn = el("confirmRejectBtn");
        btn.disabled = true;
        btn.textContent = "Rejecting...";
        try {
          const res = await fetch("/api/reject-document", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ leadId: docToReject.leadId, documentId: docToReject.documentId })
          });
          if (!res.ok) throw new Error("Failed to reject document");
          closeRejectModal();
          load();
        } catch (e) {
          alert("Error rejecting document: " + e.message);
        } finally {
          btn.disabled = false;
          btn.textContent = "Reject";
        }
      });

      window.rejectDocument = function (leadId, documentId) {
        docToReject = { leadId, documentId };
        el("rejectModalBackdrop").hidden = false;
      };

      el("openAdd").addEventListener("click", function () {
        openModalForAdd();
      });
      el("closeModal").addEventListener("click", closeModal);
      el("cancelAdd").addEventListener("click", closeModal);
      el("modalBackdrop").addEventListener("click", (e) => {
        if (e.target === el("modalBackdrop")) closeModal();
      });

      el("closeFollowUpModal").addEventListener("click", closeFollowUpModal);
      el("cancelFollowUp").addEventListener("click", closeFollowUpModal);
      el("followUpBackdrop").addEventListener("click", function (e) {
        if (e.target === el("followUpBackdrop")) closeFollowUpModal();
      });

      el("followUpForm").addEventListener("submit", async function (e) {
        e.preventDefault();
        if (!followUpLead || typeof followUpLead.rowIndex !== "number") return;
        const errEl = el("followUpError");
        const btn = el("submitFollowUp");
        errEl.hidden = true;
        errEl.textContent = "";
        btn.disabled = true;
        try {
          const res = await fetch("/api/leads/" + followUpLead.rowIndex + "/follow-up", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              note: el("followUpNote").value,
              sendWhatsApp: el("followUpSendWa").checked,
            }),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            errEl.textContent = data.error || "Could not save.";
            errEl.hidden = false;
            return;
          }
          let msg = "Follow-up saved.";
          if (data.whatsappSent) {
            msg += " WhatsApp reminder sent.";
          }
          if (data.whatsappWarning) {
            msg += " " + data.whatsappWarning;
          }
          el("success").textContent = msg;
          el("success").hidden = false;
          setTimeout(function () {
            el("success").hidden = true;
          }, 7000);
          closeFollowUpModal();
          await load();
        } catch {
          errEl.textContent = "Network error. Try again.";
          errEl.hidden = false;
        } finally {
          btn.disabled = false;
        }
      });

      // Sort Dropdown
      const sortMenuBtn = document.getElementById("sortMenuBtn");
      const sortMenu = document.getElementById("sortMenu");
      if (sortMenuBtn && sortMenu) {
        sortMenuBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          const isExpanded = sortMenuBtn.getAttribute("aria-expanded") === "true";
          sortMenuBtn.setAttribute("aria-expanded", !isExpanded);
          sortMenu.hidden = isExpanded;
        });
        document.addEventListener("click", (e) => {
          if (!sortMenu.contains(e.target) && !sortMenuBtn.contains(e.target)) {
            sortMenuBtn.setAttribute("aria-expanded", "false");
            sortMenu.hidden = true;
          }
        });
        sortMenu.querySelectorAll(".filter-option").forEach((btn) => {
          btn.addEventListener("click", () => {
            currentSort = btn.getAttribute("data-sort");
            sortMenu.querySelectorAll(".filter-option").forEach((b) => b.setAttribute("aria-checked", "false"));
            btn.setAttribute("aria-checked", "true");
            sortMenuBtn.setAttribute("aria-expanded", "false");
            sortMenu.hidden = true;
            render();
          });
        });
      }

      el("addForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const modalErr = el("modalError");
        const submitBtn = el("submitAdd");
        let keepSubmitDisabled = false;
        modalErr.hidden = true;
        submitBtn.disabled = true;
        try {
          const requiredDocIds = [];
          const requiredDocCounts = {};
          el("requiredDocsFields").querySelectorAll("[data-doc-multibase]").forEach(function (cb) {
            if (!cb.checked) return;
            const base = cb.getAttribute("data-doc-multibase");
            const wrap = cb.closest(".doc-check--multi");
            const numEl = wrap && wrap.querySelector(".doc-count-input");
            let n = numEl ? parseInt(numEl.value, 10) : 1;
            if (Number.isNaN(n) || n < 1) n = 1;
            const max = numEl ? parseInt(numEl.getAttribute("max") || "10", 10) : 10;
            if (n > max) n = max;
            requiredDocCounts[base] = n;
          });
          el("requiredDocsFields")
            .querySelectorAll('input[type="checkbox"]:not([data-doc-multibase])')
            .forEach(function (c) {
              if (c.checked) requiredDocIds.push(c.value);
            });
          const hasAnyDoc =
            requiredDocIds.length > 0 || Object.keys(requiredDocCounts).length > 0;
          if (!hasAnyDoc) {
            modalErr.textContent = "Select at least one document to collect.";
            modalErr.hidden = false;
            return;
          }

          const phoneVal = el("newPhone").value.replace(/\D/g, "");
          if (phoneVal.length !== 10) {
            modalErr.textContent = "Phone number must be exactly 10 digits.";
            modalErr.hidden = false;
            return;
          }

          const trimmedName = String(el("newName").value ?? "").trim();
          if (!trimmedName) {
            modalErr.textContent = "Enter the client's name.";
            modalErr.hidden = false;
            return;
          }
          if (editingDbId !== null) {
            const patchBody = {
              name: el("newName").value,
              phone: el("newPhone").value,
              requiredDocIds: requiredDocIds,
            };
            if (Object.keys(requiredDocCounts).length > 0) {
              patchBody.requiredDocCounts = requiredDocCounts;
            }
            keepSubmitDisabled = true;
            try {
              const res = await fetch("/api/leads/" + editingDbId, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(patchBody),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                keepSubmitDisabled = false;
                modalErr.textContent = data.error || "Could not update client details.";
                modalErr.hidden = false;
                return;
              }
              closeModal();
              el("success").textContent = "Lead updated.";
              el("success").hidden = false;
              await load();
              setTimeout(() => {
                el("success").hidden = true;
              }, 4000);
              return;
            } catch (err) {
              keepSubmitDisabled = false;
              modalErr.textContent = "Network error. Please check your connection and try again.";
              modalErr.hidden = false;
              return;
            }
          }

          showModalAddLoading();
          keepSubmitDisabled = true;
          const postBody = {
            phone: el("newPhone").value,
            name: el("newName").value,
            requiredDocIds: requiredDocIds,
          };
          if (Object.keys(requiredDocCounts).length > 0) {
            postBody.requiredDocCounts = requiredDocCounts;
          }
          try {
            const res = await fetch("/api/leads", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(postBody),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              hideModalAddLoading();
              keepSubmitDisabled = false;
              modalErr.textContent = data.error || "Failed to save client. Please check details.";
              modalErr.hidden = false;
              return;
            }
            await load();
            el("modalAddLoading").hidden = true;
            
            // Show custom delivery warnings if WhatsApp configuration errored out
            if (data.whatsappWarning) {
              console.warn(data.whatsappWarning);
            }
            
            showModalAddCelebrate();
            keepSubmitDisabled = true;
            clearAddClientCelebrateTimer();
            addClientCelebrateTimer = setTimeout(function () {
              addClientCelebrateTimer = null;
              showModalAddSuccess();
              clearAddClientCloseTimer();
              addClientCloseTimer = setTimeout(function () {
                addClientCloseTimer = null;
                closeModal();
                
                let successMessage = `Client has been added. <a href="/upload.html?t=${data.token}" target="_blank" style="color: white; text-decoration: underline; margin-left: 10px;">Open Secure Portal manually</a>`;
                if (data.whatsappWarning) {
                  successMessage += `<div style="margin-top: 8px; color: #fef08a; font-weight: 500; font-size: 0.85rem;">⚠️ WhatsApp delivery failed. Please copy the manual link above to send manually.</div>`;
                }
                
                el("success").innerHTML = successMessage;
                el("success").hidden = false;
                setTimeout(function () {
                  if (el("success").innerHTML.includes("Open Secure Portal manually")) {
                    el("success").hidden = true;
                  }
                }, 15000);
              }, 1000);
            }, CELEBRATE_BEFORE_SUCCESS_MS);
          } catch (err) {
            hideModalAddLoading();
            keepSubmitDisabled = false;
            modalErr.textContent = "Network error. Please check your connection and try again.";
            modalErr.hidden = false;
          } finally {
            if (!keepSubmitDisabled) {
              submitBtn.disabled = false;
            }
          }
        } catch (e) {
          submitBtn.disabled = false;
        }
      });

      el("q").addEventListener("input", render);

      function closeFilterMenu() {
        const dd = el("filterMenu");
        const btn = el("filterMenuBtn");
        if (!dd.hidden) {
          dd.hidden = true;
          btn.setAttribute("aria-expanded", "false");
        }
      }

      function syncFilterMenuHighlight() {
        document.querySelectorAll(".filter-option[data-filter]").forEach(function (opt) {
          const v = opt.getAttribute("data-filter");
          const on = v === statusFilter;
          opt.setAttribute("aria-checked", on ? "true" : "false");
          opt.classList.toggle("is-active", on);
        });
        el("filterMenuBtn").classList.toggle("filter-btn--has-filter", statusFilter !== "all");
      }

      el("filterMenuBtn").addEventListener("click", function (e) {
        e.stopPropagation();
        const dd = el("filterMenu");
        if (dd.hidden) {
          closeRowMenu();
          dd.hidden = false;
          el("filterMenuBtn").setAttribute("aria-expanded", "true");
        } else {
          closeFilterMenu();
        }
      });

      document.querySelectorAll(".filter-option[data-filter]").forEach(function (opt) {
        opt.addEventListener("click", function (e) {
          e.stopPropagation();
          statusFilter = opt.getAttribute("data-filter");
          syncFilterMenuHighlight();
          closeFilterMenu();
          render();
        });
      });

      document.addEventListener("click", function (e) {
        closeRowMenu();
        if (!e.target.closest(".filter-wrap")) {
          closeFilterMenu();
        }
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          if (!el("followUpBackdrop").hidden) {
            closeFollowUpModal();
            return;
          }
          closeFilterMenu();
          closeRowMenu();
        }
      });
      window.addEventListener("resize", function () {
        closeRowMenu();
        closeFilterMenu();
      });

      syncFilterMenuHighlight();
      load();
    
