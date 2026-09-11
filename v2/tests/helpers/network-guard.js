import http from "node:http";
import https from "node:https";

/**
 * Network Isolation Guard for Offline Testing.
 * When enabled or when NO_EXTERNAL_NETWORK=true, strictly denies any outbound network connection
 * and directs developers to use mock adapters or local stubs.
 */
const originalFetch = globalThis.fetch;
const originalHttpRequest = http.request;
const originalHttpsRequest = https.request;

let isEnabled = false;

const isAllowedHost = (hostname) => {
  if (!hostname) return true;
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
};

export function enableNetworkGuard() {
  if (isEnabled) return;
  isEnabled = true;

  // 1. Guard globalThis.fetch
  globalThis.fetch = async function guardedFetch(input, init) {
    let urlString = "";
    if (typeof input === "string") {
      urlString = input;
    } else if (input instanceof URL) {
      urlString = input.href;
    } else if (input && typeof input.url === "string") {
      urlString = input.url;
    }

    try {
      const parsed = new URL(urlString);
      if (!isAllowedHost(parsed.hostname)) {
        throw new Error(
          `[Network Isolation Error] Outbound network request to "${urlString}" is blocked because NO_EXTERNAL_NETWORK=true. Use a mock adapter (e.g. MOCK_WHATSAPP=true, MOCK_GEMINI=true) instead.`
        );
      }
    } catch (err) {
      if (err.message.includes("[Network Isolation Error]")) throw err;
    }

    if (originalFetch) {
      return originalFetch.call(this, input, init);
    }
    throw new Error(`fetch not implemented for ${urlString}`);
  };

  // 2. Guard node:http and node:https
  const guardNativeModule = (mod, originalReq, protocolName) => {
    mod.request = function guardedRequest(...args) {
      let host = "";
      if (typeof args[0] === "string" || args[0] instanceof URL) {
        try {
          const parsed = new URL(args[0].toString());
          host = parsed.hostname;
        } catch (_) {}
      } else if (args[0] && typeof args[0] === "object") {
        host = args[0].hostname || args[0].host || "";
      }

      if (!isAllowedHost(host)) {
        throw new Error(
          `[Network Isolation Error] Outbound ${protocolName} request to host "${host}" is blocked because NO_EXTERNAL_NETWORK=true. Use a mock adapter instead.`
        );
      }

      return originalReq.apply(this, args);
    };
  };

  guardNativeModule(http, originalHttpRequest, "HTTP");
  guardNativeModule(https, originalHttpsRequest, "HTTPS");
}

export function disableNetworkGuard() {
  if (!isEnabled) return;
  isEnabled = false;
  globalThis.fetch = originalFetch;
  http.request = originalHttpRequest;
  https.request = originalHttpsRequest;
}

if (process.env.NO_EXTERNAL_NETWORK === "true") {
  enableNetworkGuard();
}
