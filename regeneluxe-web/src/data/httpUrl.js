const BLOCKED_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "vbscript:",
  "blob:",
]);

export function isSafeHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (BLOCKED_SCHEMES.has(lower.slice(0, lower.indexOf(":") + 1))) return false;
  if (raw.startsWith("//") || raw.includes("\\")) return false;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (!url.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

export function isPrivateOrLocalHostname(hostname) {
  const host = String(hostname || "").trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") return true;
  if (host === "metadata.google.internal" || host.endsWith(".internal")) return true;
  if (host === "169.254.169.254" || host.startsWith("169.254.")) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/** Server-side fetch targets. Operators may still save localhost as a public website URL. */
export function isSafeExternalFetchUrl(value) {
  if (!isSafeHttpUrl(value)) return false;
  try {
    const url = new URL(String(value).trim());
    if (isPrivateOrLocalHostname(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}
