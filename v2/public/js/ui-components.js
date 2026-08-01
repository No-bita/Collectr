/**
 * Centralized Custom UI System
 * Replaces browser native alert(), confirm(), prompt(), and native <select> elements.
 */

(function () {
  // Inject CSS Styles for Custom UI Components
  const style = document.createElement("style");
  style.id = "custom-ui-styles";
  style.textContent = `
    /* Toast Container */
    #ui-toast-container {
      position: fixed;
      top: 1.25rem;
      right: 1.25rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
      max-width: 380px;
      width: calc(100vw - 2.5rem);
    }
    .ui-toast {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.875rem 1.125rem;
      background: #ffffff;
      color: #0f172a;
      border-radius: 12px;
      font-size: 0.875rem;
      font-weight: 500;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
      opacity: 0;
      transform: translateY(-10px) scale(0.96);
      transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ui-toast.show {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
    .ui-toast-icon {
      font-size: 1.125rem;
      flex-shrink: 0;
    }
    .ui-toast-info { border-left: 4px solid #3b82f6; }
    .ui-toast-success { border-left: 4px solid #10b981; }
    .ui-toast-error { border-left: 4px solid #ef4444; }
    .ui-toast-warning { border-left: 4px solid #f59e0b; }

    /* Custom Modal System */
    .ui-modal-backdrop {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(15, 23, 42, 0.45);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      z-index: 99990;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.25rem;
      opacity: 0;
      transition: opacity 0.2s ease;
    }
    .ui-modal-backdrop.show {
      opacity: 1;
    }
    .ui-modal-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);
      max-width: 440px;
      width: 100%;
      padding: 1.5rem;
      transform: scale(0.94);
      transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .ui-modal-backdrop.show .ui-modal-card {
      transform: scale(1);
    }
    .ui-modal-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }
    .ui-modal-title {
      font-size: 1.125rem;
      font-weight: 700;
      color: #0f172a;
    }
    .ui-modal-body {
      font-size: 0.9375rem;
      color: #475569;
      line-height: 1.5;
      margin-bottom: 1.5rem;
    }
    .ui-modal-input {
      width: 100%;
      margin-top: 0.75rem;
      padding: 0.625rem 0.875rem;
      font-size: 0.875rem;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      outline: none;
      transition: border-color 0.15s ease;
    }
    .ui-modal-input:focus {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .ui-modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.625rem;
    }
    .ui-btn {
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      color: #334155;
      transition: all 0.15s ease;
    }
    .ui-btn:hover { background: #f8fafc; }
    .ui-btn-primary { background: #2563eb; border-color: #2563eb; color: #ffffff; }
    .ui-btn-primary:hover { background: #1d4ed8; }
    .ui-btn-danger { background: #ef4444; border-color: #ef4444; color: #ffffff; }
    .ui-btn-danger:hover { background: #dc2626; }

    /* Custom Select Component */
    .ui-select-wrapper {
      position: relative;
      display: inline-block;
      width: auto;
      min-width: 170px;
      max-width: 100%;
      flex-shrink: 0;
    }
    .ui-select-trigger {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.5rem 0.875rem;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      color: #0f172a;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s ease;
      white-space: nowrap;
    }
    .ui-select-trigger:hover {
      border-color: #94a3b8;
    }
    .ui-select-trigger:focus, .ui-select-wrapper.open .ui-select-trigger {
      border-color: #2563eb;
      box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.15);
    }
    .ui-select-arrow {
      font-size: 0.7rem;
      color: #64748b;
      transition: transform 0.2s ease;
    }
    .ui-select-wrapper.open .ui-select-arrow {
      transform: rotate(180deg);
    }
    .ui-select-dropdown {
      position: absolute;
      top: calc(100% + 4px);
      left: 0; right: 0;
      z-index: 9990;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);
      padding: 0.375rem;
      max-height: 240px;
      overflow-y: auto;
      display: none;
      opacity: 0;
      transform: translateY(-6px);
      transition: opacity 0.15s ease, transform 0.15s ease;
    }
    .ui-select-wrapper.open .ui-select-dropdown {
      display: block;
      opacity: 1;
      transform: translateY(0);
    }
    .ui-select-option {
      padding: 0.5rem 0.75rem;
      font-size: 0.875rem;
      border-radius: 6px;
      color: #1e293b;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background 0.1s ease;
    }
    .ui-select-option:hover {
      background: #f1f5f9;
    }
    .ui-select-option.selected {
      background: #eff6ff;
      color: #2563eb;
      font-weight: 600;
    }
  `;
  if (!document.getElementById("custom-ui-styles")) {
    document.head.appendChild(style);
  }

  // Helper Toast Container
  function getToastContainer() {
    let container = document.getElementById("ui-toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "ui-toast-container";
      document.body.appendChild(container);
    }
    return container;
  }

  window.UI = {
    // Toast Notification
    toast(message, type = "info", duration = 3200) {
      const container = getToastContainer();
      const toast = document.createElement("div");
      toast.className = `ui-toast ui-toast-${type}`;

      const iconMap = {
        success: "✅",
        error: "⚠️",
        warning: "⚡",
        info: "ℹ️"
      };

      toast.innerHTML = `
        <span class="ui-toast-icon">${iconMap[type] || "ℹ️"}</span>
        <span style="flex: 1;">${message}</span>
      `;
      container.appendChild(toast);

      requestAnimationFrame(() => {
        toast.classList.add("show");
      });

      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 250);
      }, duration);
    },

    // Custom Confirmation Modal
    confirm({ title = "Confirm Action", message, confirmText = "Confirm", cancelText = "Cancel", isDanger = false }) {
      return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "ui-modal-backdrop";

        backdrop.innerHTML = `
          <div class="ui-modal-card">
            <div class="ui-modal-header">
              <span style="font-size: 1.25rem;">${isDanger ? "⚠️" : "❓"}</span>
              <div class="ui-modal-title">${title}</div>
            </div>
            <div class="ui-modal-body">${message}</div>
            <div class="ui-modal-actions">
              <button class="ui-btn ui-btn-cancel">${cancelText}</button>
              <button class="ui-btn ${isDanger ? "ui-btn-danger" : "ui-btn-primary"} ui-btn-confirm">${confirmText}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => backdrop.classList.add("show"));

        const cleanup = (result) => {
          backdrop.classList.remove("show");
          setTimeout(() => {
            backdrop.remove();
            resolve(result);
          }, 200);
        };

        backdrop.querySelector(".ui-btn-cancel").onclick = () => cleanup(false);
        backdrop.querySelector(".ui-btn-confirm").onclick = () => cleanup(true);
        backdrop.onclick = (e) => {
          if (e.target === backdrop) cleanup(false);
        };
      });
    },

    // Custom Prompt Modal
    prompt({ title = "Enter Value", message = "", defaultValue = "", confirmText = "OK", cancelText = "Cancel" }) {
      return new Promise((resolve) => {
        const backdrop = document.createElement("div");
        backdrop.className = "ui-modal-backdrop";

        backdrop.innerHTML = `
          <div class="ui-modal-card">
            <div class="ui-modal-header">
              <span style="font-size: 1.25rem;">📝</span>
              <div class="ui-modal-title">${title}</div>
            </div>
            <div class="ui-modal-body">
              ${message ? `<div style="margin-bottom: 0.5rem;">${message}</div>` : ""}
              <input type="text" class="ui-modal-input" value="${defaultValue}" />
            </div>
            <div class="ui-modal-actions">
              <button class="ui-btn ui-btn-cancel">${cancelText}</button>
              <button class="ui-btn ui-btn-primary ui-btn-confirm">${confirmText}</button>
            </div>
          </div>
        `;

        document.body.appendChild(backdrop);
        requestAnimationFrame(() => {
          backdrop.classList.add("show");
          const input = backdrop.querySelector(".ui-modal-input");
          input.focus();
          input.select();
        });

        const cleanup = (result) => {
          backdrop.classList.remove("show");
          setTimeout(() => {
            backdrop.remove();
            resolve(result);
          }, 200);
        };

        const inputEl = backdrop.querySelector(".ui-modal-input");
        inputEl.onkeydown = (e) => {
          if (e.key === "Enter") cleanup(inputEl.value);
          if (e.key === "Escape") cleanup(null);
        };

        backdrop.querySelector(".ui-btn-cancel").onclick = () => cleanup(null);
        backdrop.querySelector(".ui-btn-confirm").onclick = () => cleanup(inputEl.value);
      });
    },

    // Custom Select Component Replacement
    replaceSelect(selectElement) {
      if (!selectElement) return;
      
      // If wrapper already exists, refresh options
      let wrapper = selectElement.parentElement;
      let isExisting = wrapper && wrapper.classList.contains("ui-select-wrapper");

      if (!isExisting) {
        wrapper = document.createElement("div");
        wrapper.className = "ui-select-wrapper";
        if (selectElement.style.width) {
          wrapper.style.width = selectElement.style.width;
        }
        selectElement.parentNode.insertBefore(wrapper, selectElement);
        wrapper.appendChild(selectElement);
        selectElement.style.display = "none";
      }

      let trigger = wrapper.querySelector(".ui-select-trigger");
      if (!trigger) {
        trigger = document.createElement("div");
        trigger.className = "ui-select-trigger";
        trigger.tabIndex = 0;
        wrapper.appendChild(trigger);
      }

      let dropdown = wrapper.querySelector(".ui-select-dropdown");
      if (!dropdown) {
        dropdown = document.createElement("div");
        dropdown.className = "ui-select-dropdown";
        wrapper.appendChild(dropdown);
      }

      const updateTriggerText = () => {
        const selectedOpt = selectElement.options[selectElement.selectedIndex];
        trigger.innerHTML = `
          <span>${selectedOpt ? selectedOpt.textContent : "Select..."}</span>
          <span class="ui-select-arrow">▼</span>
        `;
      };

      const populateOptions = () => {
        dropdown.innerHTML = "";
        Array.from(selectElement.options).forEach((opt, index) => {
          if (opt.disabled || (opt.value === "" && selectElement.options.length > 1)) return;
          const item = document.createElement("div");
          item.className = `ui-select-option ${index === selectElement.selectedIndex ? "selected" : ""}`;
          item.innerHTML = `
            <span>${opt.textContent}</span>
            ${index === selectElement.selectedIndex ? "<span>✓</span>" : ""}
          `;
          item.onclick = (e) => {
            e.stopPropagation();
            selectElement.selectedIndex = index;
            selectElement.dispatchEvent(new Event("change", { bubbles: true }));
            updateTriggerText();
            populateOptions();
            wrapper.classList.remove("open");
          };
          dropdown.appendChild(item);
        });
      };

      const toggleDropdown = (e) => {
        if (e) e.stopPropagation();
        const isOpen = wrapper.classList.contains("open");
        document.querySelectorAll(".ui-select-wrapper.open").forEach(w => {
          if (w !== wrapper) w.classList.remove("open");
        });
        if (isOpen) {
          wrapper.classList.remove("open");
        } else {
          wrapper.classList.add("open");
          populateOptions();
        }
      };

      trigger.onclick = toggleDropdown;

      trigger.onkeydown = (e) => {
        if (e.key === " " || e.key === "Spacebar" || e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          toggleDropdown(e);
        } else if (e.key === "Escape") {
          wrapper.classList.remove("open");
        }
      };

      updateTriggerText();

      if (!window._uiSelectGlobalClickListener) {
        window._uiSelectGlobalClickListener = true;
        document.addEventListener("click", () => {
          document.querySelectorAll(".ui-select-wrapper.open").forEach(w => w.classList.remove("open"));
        });
        document.addEventListener("keydown", (e) => {
          if (e.altKey && e.key.toLowerCase() === "a") {
            e.preventDefault();
            window.location.href = "/admin/analytics";
          } else if (e.altKey && e.key.toLowerCase() === "d") {
            e.preventDefault();
            window.location.href = "/index.html";
          }
        });
      }
    }
  };
})();
