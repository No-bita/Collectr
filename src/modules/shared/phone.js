export const IN_PHONE_CC = "91";

export function digitsOnly(s) {
  return String(s ?? "").replace(/\D/g, "");
}

export function normalizePhoneForStorage(raw) {
  const d = digitsOnly(raw);
  if (!d) return "";
  if (d.length === 10) return IN_PHONE_CC + d;
  return d;
}

export function samePhone(stored, incoming) {
  const a = digitsOnly(stored);
  const b = digitsOnly(incoming);
  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 10 && b.length >= 10) return a.slice(-10) === b.slice(-10);
  return false;
}
