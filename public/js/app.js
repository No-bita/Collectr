      let allLeads = [];
      let statusFilter = "all";
      let documentCatalog = [];
      /** `null` = add lead; number = PATCH /api/leads/:rowIndex */
      let editingRowIndex = null;
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
        const tablePanel = el("tablePanel");
        const tbody = el("tbody");
        const loading = el("tableLoading");
        if (isLoading) {
          loading.textContent = isRefreshing ? "Refreshing clients..." : "Loading clients...";
          loading.hidden = false;
          tablePanel.setAttribute("aria-busy", "true");
          tbody.setAttribute("aria-busy", "true");
          return;
        }
        loading.hidden = true;
        tablePanel.setAttribute("aria-busy", "false");
        tbody.setAttribute("aria-busy", "false");
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

      function closeRowMenu() {
        if (rowMenuDropdownEl) {
          rowMenuDropdownEl.hidden = true;
          if (rowMenuDropdownEl._menuTrigger) {
            rowMenuDropdownEl._menuTrigger.setAttribute("aria-expanded", "false");
          }
          rowMenuDropdownEl = null;
        }
      }

      function createRowMenuCell(lead) {
        const td = document.createElement("td");
        td.className = "td-row-actions";
        const wrap = document.createElement("div");
        wrap.className = "row-menu-wrap";

        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "row-menu-trigger";
        trigger.setAttribute("aria-label", "Open row menu");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-haspopup", "true");
        trigger.textContent = "\u22ee";

        const drop = document.createElement("div");
        drop.className = "row-menu-dropdown";
        drop.hidden = true;
        drop.setAttribute("role", "menu");

        const editOpt = document.createElement("button");
        editOpt.type = "button";
        editOpt.className = "row-menu-item";
        editOpt.setAttribute("role", "menuitem");
        editOpt.textContent = "Edit lead";
        editOpt.addEventListener("click", function (e) {
          e.stopPropagation();
          closeRowMenu();
          openEditLead(lead);
        });
        drop.appendChild(editOpt);

        const followOpt = document.createElement("button");
        followOpt.type = "button";
        followOpt.className = "row-menu-item";
        followOpt.setAttribute("role", "menuitem");
        followOpt.textContent = "Log follow-up";
        followOpt.addEventListener("click", function (e) {
          e.stopPropagation();
          closeRowMenu();
          openFollowUpModal(lead);
        });
        drop.appendChild(followOpt);

        trigger.addEventListener("click", function (e) {
          e.stopPropagation();
          if (rowMenuDropdownEl === drop && !drop.hidden) {
            closeRowMenu();
            return;
          }
          closeRowMenu();
          rowMenuDropdownEl = drop;
          drop._menuTrigger = trigger;
          const r = trigger.getBoundingClientRect();
          const w = 200;
          let left = r.right - w;
          if (left < 8) left = 8;
          if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
          drop.style.left = left + "px";
          drop.style.top = r.bottom + 4 + "px";
          drop.style.width = w + "px";
          drop.hidden = false;
          trigger.setAttribute("aria-expanded", "true");
        });

        wrap.appendChild(trigger);
        wrap.appendChild(drop);
        td.appendChild(wrap);
        return td;
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
        if (!ocr || typeof ocr !== "object") return null;
        const wrap = document.createElement("div");
        wrap.className = "doc-ocr-preview cell-muted";
        const fields = ocr.fields || {};
        const tokens = [];
        if (fields.name) tokens.push("Name: " + fields.name);
        if (fields.dob) tokens.push("DOB: " + fields.dob);
        if (fields.idNumber) tokens.push("ID: " + fields.idNumber);
        if (fields.vid) tokens.push("VID: " + fields.vid);
        if (!tokens.length && ocr.previewText) {
          tokens.push(ocr.previewText.slice(0, 120));
        }
        wrap.textContent = tokens.length ? tokens.join(" | ") : "OCR processed";
        if (ocr.previewText) wrap.title = ocr.previewText;
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

      /** One cell: every required document with status + link from documentsState (sheet column D). */
      function requiredDocsProgressCell(lead) {
        const td = document.createElement("td");
        td.className = "td-doc-progress";
        const ids = lead.requiredDocIds || [];
        const state = lead.documentsState || {};
        if (!ids.length) {
          td.classList.add("cell-muted");
          td.textContent = "—";
          return td;
        }
        const root = document.createElement("div");
        root.className = "doc-progress-cell";
        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const entry = state[id] || {};
          const st = entry.status || "pending";
          const link = typeof entry.link === "string" ? entry.link : "";
          const row = document.createElement("div");
          row.className = "doc-progress-row";
          const lab = document.createElement("span");
          lab.className = "doc-progress-label";
          lab.textContent = labelForDocId(id);
          const actions = document.createElement("div");
          actions.className = "doc-progress-actions";
          actions.appendChild(docStatusBadge(st));
          if (link && st === "received") {
            const a = document.createElement("a");
            a.href = link;
            a.target = "_blank";
            a.rel = "noopener noreferrer";
            a.className = "doc-file-link";
            a.textContent = "View file";
            a.setAttribute("aria-label", "Open " + labelForDocId(id) + " in Drive");
            actions.appendChild(a);
          }
          row.appendChild(lab);
          row.appendChild(actions);
          const ocrPreview = buildOcrPreview(entry);
          if (ocrPreview) row.appendChild(ocrPreview);
          root.appendChild(row);
        }
        td.appendChild(root);
        return td;
      }

      function statusBadge(status) {
        const span = document.createElement("span");
        const done = status === "Completed";
        span.className = "badge " + (done ? "badge-done" : "badge-progress");
        span.textContent = done ? "Completed" : "In progress";
        return span;
      }

      function matchesSearch(lead, q) {
        if (!q) return true;
        const phone = String(lead.phone || "").toLowerCase();
        const name = String(lead.name || "").toLowerCase();
        return phone.includes(q) || name.includes(q);
      }

      function visibleLeads() {
        const q = el("q").value.trim().toLowerCase();
        return allLeads.filter((l) => {
          if (statusFilter === "followup") {
            if (!l.needsFollowUp) return false;
          } else if (statusFilter !== "all" && l.status !== statusFilter) {
            return false;
          }
          return matchesSearch(l, q);
        });
      }

      function followUpCell(lead) {
        const td = document.createElement("td");
        td.className = "td-follow-up";
        const wrap = document.createElement("div");
        wrap.className = "follow-up-cell";

        const due = Boolean(lead.needsFollowUp);
        const dueRow = document.createElement("div");
        dueRow.className = "follow-up-due-row";

        if (due) {
          const actions = document.createElement("div");
          actions.className = "follow-up-actions";
          const sendBtn = document.createElement("button");
          sendBtn.type = "button";
          sendBtn.className = "btn btn-primary btn-follow-up-send";
          sendBtn.textContent = "Send";
          sendBtn.setAttribute(
            "title",
            "Follow-up is due (pending docs + idle past the window). Sends the WhatsApp template and refreshes Last updated.",
          );
          sendBtn.addEventListener("click", async function (e) {
            e.stopPropagation();
            if (typeof lead.rowIndex !== "number" || lead.rowIndex < 0) return;
            const oldText = sendBtn.textContent;
            sendBtn.disabled = true;
            sendBtn.textContent = "Sending...";
            sendBtn.setAttribute("aria-busy", "true");
            try {
              const res = await fetch(
                "/api/leads/" + lead.rowIndex + "/follow-up/send-template",
                { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" },
              );
              const data = await res.json().catch(function () {
                return {};
              });
              if (!res.ok) {
                showBanner("error", data.error || "Could not send follow-up.", 5000);
                return;
              }
              showBanner("success", "Follow-up template sent. Last updated refreshed.", 5000);
              await load();
            } catch {
              showBanner("error", "Network error. Try again.", 5000);
            } finally {
              sendBtn.disabled = false;
              sendBtn.textContent = oldText;
              sendBtn.setAttribute("aria-busy", "false");
            }
          });
          actions.appendChild(sendBtn);
          dueRow.appendChild(actions);
        } else {
          const valueSpan = document.createElement("span");
          valueSpan.className = "follow-up-sheet-value cell-muted";
          const done = lead.status === "Completed";
          valueSpan.textContent = done ? "No follow-ups required" : "No";
          valueSpan.setAttribute(
            "title",
            done
              ? "This client is complete; follow-up reminders do not apply."
              : "Live rule: pending required docs and idle longer than the follow-up window (recalculated on each load).",
          );
          dueRow.appendChild(valueSpan);
        }

        wrap.appendChild(dueRow);

        const lastAct = document.createElement("div");
        lastAct.className = "follow-up-last-activity";
        const rel = formatLastActivityLine(lead.lastUpdated);
        lastAct.textContent = rel;
        lastAct.setAttribute(
          "title",
          "Last updated in the sheet (any WhatsApp or dashboard activity).",
        );
        wrap.appendChild(lastAct);

        td.appendChild(wrap);
        if (lead.followUpNote && String(lead.followUpNote).trim()) {
          td.title = String(lead.followUpNote).trim();
        }
        return td;
      }

      function measureTableContentHeight() {
        const table = el("tbody").closest("table");
        if (!table) return 0;
        const thead = table.querySelector("thead");
        let h = 0;
        if (thead) {
          h += thead.getBoundingClientRect().height;
        }
        el("tbody").querySelectorAll("tr:not(.table-guide-row)").forEach(function (row) {
          h += row.getBoundingClientRect().height;
        });
        return h;
      }

      function scheduleTableGuideRow() {
        if (tableGuideRaf != null) {
          cancelAnimationFrame(tableGuideRaf);
        }
        tableGuideRaf = requestAnimationFrame(function () {
          tableGuideRaf = null;
          updateTableGuideRow();
        });
      }

      function updateTableGuideRow() {
        const panel = el("tablePanel");
        const tbody = el("tbody");
        if (!panel || !tbody) return;

        const existing = tbody.querySelector("tr.table-guide-row");
        if (existing) existing.remove();

        if (tbody.querySelectorAll("tr:not(.table-guide-row)").length === 0) return;

        const contentH = measureTableContentHeight();
        const gap = panel.clientHeight - contentH;
        if (gap < TABLE_GUIDE_MIN_GAP_PX) return;

        const fillH = Math.max(TABLE_GUIDE_MIN_GAP_PX, Math.floor(gap) - 12);

        const tr = document.createElement("tr");
        tr.className = "table-guide-row";

        const td = document.createElement("td");
        td.colSpan = TABLE_GUIDE_COLS;
        td.className = "table-guide-cell";

        const fill = document.createElement("div");
        fill.className = "table-guide-fill";
        fill.style.minHeight = fillH + "px";

        const msg = document.createElement("p");
        msg.className = "table-guide-msg";
        msg.appendChild(document.createTextNode("Add another client using "));
        const em = document.createElement("strong");
        em.className = "table-guide-em";
        em.textContent = "Create";
        msg.appendChild(em);
        msg.appendChild(document.createTextNode(" above."));

        fill.appendChild(msg);
        td.appendChild(fill);
        tr.appendChild(td);
        tbody.appendChild(tr);
      }

      function render() {
        const tbody = el("tbody");
        const empty = el("empty");
        const rows = visibleLeads();
        tbody.innerHTML = "";

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
          const tr = document.createElement("tr");

          const tdIdx = document.createElement("td");
          tdIdx.className = "td-index";
          tdIdx.textContent = String(i + 1);

          const tdName = document.createElement("td");
          tdName.textContent = lead.name || "—";
          if (!lead.name) tdName.className = "cell-muted";

          const tdPhone = document.createElement("td");
          tdPhone.className = "cell-strong";
          tdPhone.textContent = lead.phone || "—";

          const tdReq = document.createElement("td");
          tdReq.className = "cell-doc-list";
          tdReq.textContent = formatRequiredDocLabels(lead.requiredDocIds || []);

          tr.appendChild(tdIdx);
          tr.appendChild(tdName);
          tr.appendChild(tdPhone);
          tr.appendChild(tdReq);
          tr.appendChild(requiredDocsProgressCell(lead));

          const tdSt = document.createElement("td");
          tdSt.appendChild(statusBadge(lead.status));
          tr.appendChild(tdSt);

          tr.appendChild(followUpCell(lead));
          tr.appendChild(createRowMenuCell(lead));

          tbody.appendChild(tr);
        }

        scheduleTableGuideRow();
      }

      function setSummary(s) {
        el("statTotal").textContent = s.total;
        el("statDone").textContent = s.completed;
        el("statFollowUp").textContent =
          s.followUpDue != null && s.followUpDue !== undefined ? s.followUpDue : "—";
        const totalDocsRequired = allLeads.reduce(function (sum, lead) {
          return sum + ((lead.requiredDocIds && lead.requiredDocIds.length) || 0);
        }, 0);
        el("statDocs").textContent = totalDocsRequired;
      }

      function resetModalAddMode() {
        editingRowIndex = null;
        el("modalTitle").textContent = "Add client";
        el("newPhone").readOnly = false;
        el("newPhone").required = true;
        el("newName").readOnly = false;
        el("newName").required = true;
        el("newFirmName").readOnly = false;
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
        editingRowIndex =
          typeof lead.rowIndex === "number" && lead.rowIndex >= 0 ? lead.rowIndex : null;
        if (editingRowIndex === null) {
          return;
        }
        el("modalTitle").textContent = "Edit";
        el("submitAdd").textContent = "Save changes";
        el("newPhone").readOnly = false;
        el("newPhone").required = true;
        el("newName").readOnly = false;
        el("newName").required = true;
        el("newFirmName").readOnly = false;
        el("newName").value = lead.name || "";
        el("newPhone").value = lead.phone || "";
        el("newFirmName").value = lead.firmName || "";
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
        el("requiredDocsFields").querySelectorAll("[data-doc-multibase]").forEach(function (cb) {
          const base = cb.getAttribute("data-doc-multibase");
          if (base === "bank_statement") {
            cb.checked = bankN >= 1;
            const wrap = cb.closest(".doc-check--multi");
            const num = wrap && wrap.querySelector(".doc-count-input");
            if (num) {
              num.value = String(Math.max(1, bankN || 1));
              num.disabled = !cb.checked;
            }
          }
        });
        el("requiredDocsFields")
          .querySelectorAll('input[type="checkbox"]:not([data-doc-multibase])')
          .forEach(function (cb) {
            cb.checked = selected.has(cb.value);
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
        el("followUpClientLine").textContent =
          (lead.name || "Client") + " · " + (lead.phone || "—");
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
        const btn = el("refresh");
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
          const ft = data.fetchedAt ? formatWhen(data.fetchedAt) : "";
          el("fetchedAt").textContent = ft ? "Last updated: " + ft : "Last updated: —";
          render();
        } catch (e) {
          err.textContent = e.message || "Could not load data.";
          err.hidden = false;
        } finally {
          btn.disabled = false;
          setTableLoading(false, false);
        }
      }

      el("refresh").addEventListener("click", load);
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

          const trimmedName = String(el("newName").value ?? "").trim();
          if (!trimmedName) {
            modalErr.textContent = "Enter the client's name.";
            modalErr.hidden = false;
            return;
          }
          const trimmedFirmName = String(el("newFirmName").value ?? "").trim();

          if (editingRowIndex !== null) {
            const patchBody = {
              name: el("newName").value,
              phone: el("newPhone").value,
              firmName: trimmedFirmName,
              requiredDocIds: requiredDocIds,
            };
            if (Object.keys(requiredDocCounts).length > 0) {
              patchBody.requiredDocCounts = requiredDocCounts;
            }
            const res = await fetch("/api/leads/" + editingRowIndex, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(patchBody),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              modalErr.textContent = data.error || "Could not update.";
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
          }

          showModalAddLoading();
          keepSubmitDisabled = true;
          const postBody = {
            phone: el("newPhone").value,
            name: el("newName").value,
            firmName: trimmedFirmName,
            requiredDocIds: requiredDocIds,
          };
          if (Object.keys(requiredDocCounts).length > 0) {
            postBody.requiredDocCounts = requiredDocCounts;
          }
          const res = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(postBody),
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) {
            hideModalAddLoading();
            keepSubmitDisabled = false;
            modalErr.textContent = data.error || "Could not save.";
            modalErr.hidden = false;
            return;
          }
          await load();
          el("modalAddLoading").hidden = true;
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
              el("success").textContent = "Client has been added.";
              el("success").hidden = false;
              setTimeout(function () {
                el("success").hidden = true;
              }, 4000);
            }, 5000);
          }, CELEBRATE_BEFORE_SUCCESS_MS);
        } catch {
          hideModalAddLoading();
          keepSubmitDisabled = false;
          modalErr.textContent = "Network error. Try again.";
          modalErr.hidden = false;
        } finally {
          if (!keepSubmitDisabled) {
            submitBtn.disabled = false;
          }
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
      el("tablePanel").addEventListener("scroll", function () {
        closeRowMenu();
        closeFilterMenu();
      });
      window.addEventListener("resize", function () {
        closeRowMenu();
        closeFilterMenu();
        scheduleTableGuideRow();
      });

      if (typeof ResizeObserver !== "undefined") {
        const tableGuideResizeObserver = new ResizeObserver(function () {
          clearTimeout(tableGuideResizeTimer);
          tableGuideResizeTimer = setTimeout(function () {
            scheduleTableGuideRow();
          }, 80);
        });
        tableGuideResizeObserver.observe(el("tablePanel"));
      }

      syncFilterMenuHighlight();
      load();
    
