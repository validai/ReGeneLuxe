/**
 * Profile image rules. Size is always the raw File/blob byte length.
 * Never compare base64 or data-URL length to this limit.
 *
 * SVG is intentionally unsupported.
 */

export const PROFILE_IMAGE_MAX_KB = 500;
export const PROFILE_IMAGE_MAX_BYTES = PROFILE_IMAGE_MAX_KB * 1024;
export const PROFILE_IMAGE_MIN_EDGE = 256;
export const PROFILE_IMAGE_MAX_EDGE = 4096;

export const PROFILE_IMAGE_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export const PROFILE_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

export function isInlineDataUrl(value) {
  return String(value || "").trim().toLowerCase().startsWith("data:");
}

export function encodedPayloadLength(byteLength) {
  const bytes = Number(byteLength) || 0;
  return 4 * Math.ceil(bytes / 3);
}

export function formatBytesAsKb(bytes) {
  const value = Math.max(0, Number(bytes) || 0);
  return `${Math.round(value / 1024)} KB`;
}

export function normalizeImageMime(file) {
  const type = String(file?.type || "").toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (PROFILE_IMAGE_MIME[type]) return type;
  const name = String(file?.name || "").toLowerCase();
  if (name.endsWith(".svg") || type === "image/svg+xml") return "image/svg+xml";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "image/jpeg";
  if (name.endsWith(".webp")) return "image/webp";
  return type || "";
}

export function validateProfileImageFile(file) {
  if (!file) return { ok: true, skipped: true };
  const mime = normalizeImageMime(file);
  if (!PROFILE_IMAGE_MIME[mime]) {
    return {
      ok: false,
      code: "mime",
      error: "PNG, JPG, or WebP images are supported.",
    };
  }
  const bytes = Number(file.size);
  if (!Number.isFinite(bytes) || bytes < 0) {
    return {
      ok: false,
      code: "size",
      error: "We couldn't read this image. Try another PNG, JPG, or WebP file.",
    };
  }
  if (bytes > PROFILE_IMAGE_MAX_BYTES) {
    return {
      ok: false,
      code: "size",
      bytes,
      error: `Image is ${formatBytesAsKb(bytes)}. Maximum size is ${PROFILE_IMAGE_MAX_KB} KB.`,
    };
  }
  return { ok: true, mime, bytes };
}

export function validateImageDimensions(width, height) {
  const w = Number(width) || 0;
  const h = Number(height) || 0;
  if (w < 1 || h < 1) {
    return {
      ok: false,
      code: "decode",
      error: "We couldn't read this image. Try another PNG, JPG, or WebP file.",
    };
  }
  if (w < PROFILE_IMAGE_MIN_EDGE || h < PROFILE_IMAGE_MIN_EDGE) {
    return {
      ok: false,
      code: "dimensions",
      width: w,
      height: h,
      error: `Image must be at least ${PROFILE_IMAGE_MIN_EDGE} × ${PROFILE_IMAGE_MIN_EDGE} pixels.`,
    };
  }
  if (w > PROFILE_IMAGE_MAX_EDGE || h > PROFILE_IMAGE_MAX_EDGE) {
    return {
      ok: false,
      code: "dimensions",
      width: w,
      height: h,
      error: "Image dimensions exceed the supported maximum.",
    };
  }
  return { ok: true, width: w, height: h };
}

export function sanitizeAvatarUrl(value) {
  const url = String(value || "").trim();
  if (!url || isInlineDataUrl(url)) return "";
  return url;
}
