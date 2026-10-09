/**
 * Canonical origin for Auth.js and provider callbacks.
 *
 * Development browser identity is http://localhost:<port>. Numeric loopback
 * (127.0.0.1, ::1) is folded onto localhost so Google, Meta, and the session
 * cookie share one host. Production uses AUTH_URL exactly and is never
 * rewritten to localhost.
 *
 * 127.0.0.1 is not HTTP-redirected. A redirect would change redirect_uri and
 * drop the host-only Auth.js cookie. Operators should open localhost.
 */

export const DEFAULT_CANONICAL_ORIGIN = "http://localhost:5174";

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

export function isProductionOriginMode(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv === "production";
}

/**
 * Always false. Development does not redirect between localhost and 127.0.0.1.
 */
export function shouldRedirectLocalhostAlias() {
  return false;
}

function devPort() {
  return process.env.REGENELUXE_UI_PORT || process.env.RL_UI_PORT || "5174";
}

export function canonicalizeOrigin(raw, nodeEnv = process.env.NODE_ENV) {
  const url = new URL(raw);
  if (!isProductionOriginMode(nodeEnv) && isLoopbackHostname(url.hostname)) {
    url.hostname = "localhost";
  }
  return url.origin;
}

export function canonicalOAuthRedirect(value, nodeEnv = process.env.NODE_ENV) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (!isProductionOriginMode(nodeEnv) && isLoopbackHostname(url.hostname)) {
      url.hostname = "localhost";
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function getCanonicalOrigin(nodeEnv = process.env.NODE_ENV) {
  const raw = process.env.AUTH_URL || process.env.NEXTAUTH_URL || "";
  if (raw) {
    try {
      return canonicalizeOrigin(raw, nodeEnv);
    } catch {
      // fall through to the environment default
    }
  }
  if (isProductionOriginMode(nodeEnv)) return `http://127.0.0.1:${devPort()}`;
  return `http://localhost:${devPort()}`;
}

export function publicAppOrigin(nodeEnv = process.env.NODE_ENV) {
  const raw = process.env.RL_PUBLIC_ORIGIN || "";
  if (raw) {
    try {
      return canonicalizeOrigin(raw, nodeEnv);
    } catch {
      // fall through
    }
  }
  return getCanonicalOrigin(nodeEnv);
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
 * Development keeps that origin on localhost so the Google redirect_uri matches AUTH_URL.
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
