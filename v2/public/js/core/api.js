/**
 * Core API & Authentication fetch helper.
 */
export async function authFetch(url, options = {}) {
  let token = localStorage.getItem("collectrr_auth");
  const isDev =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1");

  if (!token && isDev) {
    token = "Bearer dev_token";
  } else if (!token) {
    if (typeof window !== "undefined") {
      window.location.href = `/login.html?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
    }
    throw new Error("Authentication required");
  }

  const headers = {
    ...options.headers,
    Authorization: token,
  };

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401 && !isDev) {
    localStorage.removeItem("collectrr_auth");
    if (typeof window !== "undefined") {
      window.location.href = `/login.html?redirect=${encodeURIComponent(
        window.location.pathname + window.location.search
      )}`;
    }
    throw new Error("Session expired. Please log in again.");
  }
  return res;
}
