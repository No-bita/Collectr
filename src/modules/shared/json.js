export function safeParseJSON(str, fallback) {
  if (str == null || str === "") return fallback;
  if (typeof str === "object" && str !== null && !Array.isArray(str)) return str;
  try {
    return JSON.parse(String(str));
  } catch {
    return fallback;
  }
}
