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

export function googleCallbackUrl() {
  return `${getCanonicalOrigin()}/api/auth/callback/google`;
}

export function gmailCallbackUrl() {
  return `${getCanonicalOrigin()}/api/oauth/gmail/callback`;
}

export function toCanonicalPath(url, baseUrl = getCanonicalOrigin()) {
  if (!url) return baseUrl;
  if (url.startsWith("/")) return `${baseUrl}${url}`;
  try {
    const parsed = new URL(url);
    if (isLoopbackHostname(parsed.hostname) || parsed.origin === baseUrl) {
      return `${baseUrl}${parsed.pathname}${parsed.search}`;
    }
  } catch {
    return baseUrl;
  }
  return baseUrl;
}
