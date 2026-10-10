/**
 * Local-only HTTPS front for Threads OAuth.
 * The Next app stays on http://localhost:5174. This module never proxies
 * arbitrary paths and never reads or logs an authorization code.
 */

import { randomBytes } from "node:crypto";

export const THREADS_BRIDGE_HOST = "threads.regeneluxe.test";
export const THREADS_BRIDGE_PORT = 5175;
export const THREADS_BRIDGE_ORIGIN = `https://${THREADS_BRIDGE_HOST}:${THREADS_BRIDGE_PORT}`;
export const THREADS_CALLBACK_PATH = "/api/oauth/threads/callback";
export const THREADS_DEAUTHORIZE_PATH = "/api/oauth/threads/deauthorize";
export const THREADS_DATA_DELETION_PATH = "/api/oauth/threads/data-deletion";
export const THREADS_CALLBACK_URL = `${THREADS_BRIDGE_ORIGIN}${THREADS_CALLBACK_PATH}`;
export const THREADS_DEAUTHORIZE_URL = `${THREADS_BRIDGE_ORIGIN}${THREADS_DEAUTHORIZE_PATH}`;
export const THREADS_DATA_DELETION_URL = `${THREADS_BRIDGE_ORIGIN}${THREADS_DATA_DELETION_PATH}`;
export const CANONICAL_APP_ORIGIN = "http://localhost:5174";

const CALLBACK_QUERY_KEYS = ["code", "state", "error", "error_reason", "error_description"];

export function threadsRedirectUri(value = process.env.THREADS_REDIRECT_URI) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return "";
    if (url.hostname !== THREADS_BRIDGE_HOST) return "";
    if (url.port !== String(THREADS_BRIDGE_PORT)) return "";
    if (url.username || url.password || url.hash) return "";
    if (url.pathname !== THREADS_CALLBACK_PATH) return "";
    if (url.search) return "";
    return `${url.origin}${url.pathname}`;
  } catch {
    return "";
  }
}

function bridgeHost(hostHeader) {
  return String(hostHeader || "").toLowerCase() === `${THREADS_BRIDGE_HOST}:${THREADS_BRIDGE_PORT}`;
}

function callbackLocation(requestUrl) {
  const incoming = new URL(requestUrl, THREADS_BRIDGE_ORIGIN);
  const forward = new URL(THREADS_CALLBACK_PATH, CANONICAL_APP_ORIGIN);
  CALLBACK_QUERY_KEYS.forEach((key) => {
    const value = incoming.searchParams.get(key);
    if (value != null) forward.searchParams.set(key, value);
  });
  return forward.toString();
}

function deletionReceipt() {
  const confirmation = randomBytes(9).toString("hex");
  const status = new URL(THREADS_DATA_DELETION_PATH, THREADS_BRIDGE_ORIGIN);
  status.searchParams.set("id", confirmation);
  return {
    url: status.toString(),
    confirmation_code: confirmation,
  };
}

/**
 * Decide one bridge response. Callers must not log the returned Location.
 */
export function handleThreadsHttpsRequest({ method = "GET", url = "/", host = "" } = {}) {
  const verb = String(method || "GET").toUpperCase();
  if (!bridgeHost(host)) {
    return { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Not found" };
  }
  const path = new URL(url, THREADS_BRIDGE_ORIGIN).pathname;
  if (path === THREADS_CALLBACK_PATH) {
    if (verb !== "GET") {
      return { status: 405, headers: { Allow: "GET", "Content-Type": "text/plain; charset=utf-8" }, body: "Method not allowed" };
    }
    return {
      status: 302,
      headers: {
        Location: callbackLocation(url),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
      body: "",
    };
  }
  if (path === THREADS_DEAUTHORIZE_PATH) {
    if (verb !== "GET" && verb !== "POST") {
      return { status: 405, headers: { Allow: "GET, POST", "Content-Type": "text/plain; charset=utf-8" }, body: "Method not allowed" };
    }
    return { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, body: "ok" };
  }
  if (path === THREADS_DATA_DELETION_PATH) {
    if (verb === "POST") {
      return {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
        body: JSON.stringify(deletionReceipt()),
      };
    }
    if (verb === "GET") {
      return {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
        body: "Threads data-deletion status is local to this machine.",
      };
    }
    return { status: 405, headers: { Allow: "GET, POST", "Content-Type": "text/plain; charset=utf-8" }, body: "Method not allowed" };
  }
  return { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" }, body: "Not found" };
}
