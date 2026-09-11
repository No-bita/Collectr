/**
 * Core DOM helpers and formatters.
 */
export const el = (id) => document.getElementById(id);

export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatLacs(amount) {
  if (amount === null || amount === undefined || amount === "") return "—";
  const num = parseFloat(amount);
  if (isNaN(num)) return "—";
  return `₹${num} Lacs`;
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  } catch (_) {
    return dateString;
  }
}
