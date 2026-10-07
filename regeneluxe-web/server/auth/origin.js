/**
 * Canonical local origin for Auth.js.
 *
 * Next.js can report `localhost` even when the operator opened `127.0.0.1`.
 * Google requires the token-exchange redirect_uri to match the authorization
 * redirect_uri exactly, so Auth.js must use one host for the whole flow.
 */

export const DEFAULT_CANONICAL_ORIGIN = "http://127.0.0.1:5174";

export function hostnameFromHostHeader(hostHeader) {
  return String(hostHeader || "")
    .split(":")[0]
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
}

export function isLoopbackHostname(hostname) {
  const host = hostnameFromHostHeader(hostname);
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

export function shouldRedirectLocalhostAlias(hostHeader) {
  const hostname = hostnameFromHostHeader(hostHeader);
  return hostname === "localhost" || hostname === "::1";
}

export function getCanonicalOrigin() {
  const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
  try {
    if (raw) {
      const url = new URL(raw);
      if (url.hostname === "localhost" || url.hostname === "::1") {
        url.hostname = "127.0.0.1";
      }
      return url.origin;
    }
  } catch {
    // fall through to default
  }
  const port = process.env.REGENELUXE_UI_PORT || process.env.RL_UI_PORT || "5174";
  return `http://127.0.0.1:${port}`;
}

export function canonicalRequestUrl(requestUrl) {
  const incoming = new URL(requestUrl);
  return new URL(`${incoming.pathname}${incoming.search}`, getCanonicalOrigin());
}

export function withCanonicalHostHeaders(headers, origin = getCanonicalOrigin()) {
  const next = new Headers(headers);
  const parsed = new URL(origin);
  next.set("host", parsed.host);
  next.set("x-forwarded-host", parsed.host);
  next.set("x-forwarded-proto", parsed.protocol.replace(":", ""));
  return next;
}

export function cookieHeaderHasPkce(cookieHeader) {
  return /(?:^|;\s*)(?:__Secure-)?authjs\.pkce\.code_verifier=/.test(String(cookieHeader || ""));
}

export function mergeAuthCookieHeader(headerCookie, jarCookie) {
  const header = String(headerCookie || "");
  const jar = String(jarCookie || "");
  if (cookieHeaderHasPkce(header)) return header;
  if (jar) return jar;
  return header;
}

/**
 * Rebuild the Auth.js request on the canonical origin without dropping PKCE/state cookies.
 * Next.js can report `localhost` even when the browser is on `127.0.0.1`.
 */
export function toCanonicalAuthRequest(req, extraCookieHeader = "") {
  const url = canonicalRequestUrl(req.url);
  const headers = withCanonicalHostHeaders(req.headers);
  const merged = mergeAuthCookieHeader(headers.get("cookie"), extraCookieHeader);
  if (merged) headers.set("cookie", merged);
  const init = { method: req.method, headers };
  if (req.method !== "GET" && req.method !== "HEAD" && req.body) {
    init.body = req.body;
    init.duplex = "half";
  }
  return new Request(url, init);
}

export function googleCallbackUrl() {
  return `${getCanonicalOrigin()}/api/auth/callback/google`;
}

export function gmailCallbackUrl() {
  return `${getCanonicalOrigin()}/api/oauth/gmail/callback`;
}

export function youtubeCallbackUrl() {
  return `${getCanonicalOrigin()}/api/oauth/youtube/callback`;
}

export function isSafeLocalPath(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return false;
  if (raw.includes("://")) return false;
  return true;
}

export function safeReturnTo(value, fallback = "/") {
  if (!isSafeLocalPath(value)) return fallback;
  return String(value).trim();
}

export function isAllowedRequestOrigin(request) {
  const allowed = new Set([getCanonicalOrigin()]);
  try {
    allowed.add(new URL(getCanonicalOrigin()).origin);
  } catch {
    /* ignore */
  }
  allowed.add("http://127.0.0.1:5174");
  allowed.add("http://localhost:5174");

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (allowed.has(parsed.origin)) return true;
      if (isLoopbackHostname(parsed.hostname) && String(parsed.port || "") === "5174") return true;
    } catch {
      return false;
    }
    return false;
  }
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") return false;
  return true;
}

export function toCanonicalPath(url, baseUrl = getCanonicalOrigin()) {
  if (!url) return baseUrl;
  const raw = String(url).trim();
  if (raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") && !raw.includes("://")) {
    return `${baseUrl}${raw}`;
  }
  try {
    const parsed = new URL(raw);
    if (isLoopbackHostname(parsed.hostname) || parsed.origin === baseUrl) {
      const path = `${parsed.pathname}${parsed.search}`;
      if (path.startsWith("//")) return baseUrl;
      return `${baseUrl}${path}`;
    }
  } catch {
    return baseUrl;
  }
  return baseUrl;
}
