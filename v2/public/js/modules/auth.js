import { el } from "../core/dom.js";
import { authFetch } from "../core/api.js";
import { state, setCurrentUser } from "../core/state.js";

/**
 * Authentication & User Session Module.
 */
export async function initAuth() {
  const isDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  let token = localStorage.getItem("collectrr_auth");
  if (!token && isDev) {
    token = "Bearer dev_token";
    localStorage.setItem("collectrr_auth", token);
  }

  if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = `/login.html?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
    }
    return null;
  }

  try {
    const res = await authFetch("/api/user/profile");
    if (res.ok) {
      const user = await res.json();
      setCurrentUser(user);
      renderUserProfile(user);
      return user;
    }
  } catch (err) {
    console.warn("Could not fetch user profile:", err);
  }

  // Fallback profile if offline/dev
  const fallbackUser = { id: "admin", username: "DevAgent", role: "admin" };
  setCurrentUser(fallbackUser);
  renderUserProfile(fallbackUser);
  return fallbackUser;
}

export function renderUserProfile(user) {
  const userNameEl = el("userNameDisplay");
  const userRoleBadge = el("userRoleBadge");
  const btnTemplate = el("btnOpenTemplateModal");
  const btnDocMapping = el("btnOpenDocMappingModal");

  if (userNameEl) {
    userNameEl.textContent = user.username || user.name || "Agent";
  }

  const isAdmin = user.role === "admin" || user.id === "admin";
  if (userRoleBadge) {
    userRoleBadge.textContent = isAdmin ? "Administrator" : "Agent";
    userRoleBadge.className = isAdmin ? "badge-admin" : "badge-agent";
  }

  if (btnTemplate) {
    btnTemplate.style.display = isAdmin ? "" : "none";
  }
  if (btnDocMapping) {
    btnDocMapping.style.display = isAdmin ? "" : "none";
  }
}

export function logout() {
  localStorage.removeItem("collectrr_auth");
  if (typeof window !== "undefined") {
    window.location.href = "/login.html";
  }
}
