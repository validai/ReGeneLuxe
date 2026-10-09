/**
 * Provider media reachability.
 * Instagram container URLs must be public HTTPS. Local Mac paths are not.
 */

const PRIVATE_HOST = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|.*\.local)$/i;

function isPrivateIpv4(hostname) {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(hostname);
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a === 10 || a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
}

export function classifyMediaUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "MISSING_MEDIA";
  if (raw.startsWith("file:") || raw.startsWith("/") || raw.startsWith(".")) return "LOCAL_ONLY_MEDIA";
  let url;
  try {
    url = new URL(raw);
  } catch {
    return "LOCAL_ONLY_MEDIA";
  }
  if (url.protocol !== "https:") return "LOCAL_ONLY_MEDIA";
  if (url.hostname === "::1" || PRIVATE_HOST.test(url.hostname) || isPrivateIpv4(url.hostname)) return "LOCAL_ONLY_MEDIA";
  return "PUBLIC_PROVIDER_MEDIA";
}

export function assertPublicProviderMedia(value) {
  const kind = classifyMediaUrl(value);
  if (kind === "PUBLIC_PROVIDER_MEDIA") return { ok: true, url: String(value).trim(), kind };
  return {
    ok: false,
    kind,
    code: "MEDIA_PUBLIC_URL_REQUIRED",
    error: "MEDIA_PUBLIC_URL_REQUIRED",
  };
}
