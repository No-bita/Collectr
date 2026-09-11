import { el, escapeHtml } from "../core/dom.js";
import { authFetch } from "../core/api.js";

/**
 * WhatsApp Message Templates Module.
 * Feature-specific state is encapsulated here.
 */
let activeTemplateTab = "list";
let cachedTemplates = [];
let currentEditingTemplateId = null;

export function openTemplateModal() {
  const backdrop = el("templateModalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = false;
  currentEditingTemplateId = null;
  switchTemplateTab("list");
  loadTemplatesList();
}

export function closeTemplateModal() {
  const backdrop = el("templateModalBackdrop");
  if (!backdrop) return;
  backdrop.hidden = true;
  currentEditingTemplateId = null;
}

export function switchTemplateTab(tab) {
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

export async function fetchTemplates() {
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

export async function loadTemplatesList() {
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

export function renderTemplatesList(templates) {
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

  sortedTemplates.forEach((tpl) => {
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

export function insertTemplateToken(token) {
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

export function updateTemplateLivePreview() {
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
      liveHeader.textContent = headerInput.value.trim().replace(/\{\{1\}\}/g, "Test Client");
      liveHeader.style.display = "";
    } else {
      liveHeader.style.display = "none";
    }
  }

  // 2. Body Handling
  const rawBody = bodyInput && bodyInput.value ? bodyInput.value : "Hi {{1}}, please upload your pending documents using the secure link: {{2}}";
  const renderedBody = rawBody
    .replace(/\{\{1\}\}/g, "Test Client")
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

export async function saveCustomTemplate() {
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

export async function deleteCustomTemplate(id) {
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

export function editCustomTemplate(name) {
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
