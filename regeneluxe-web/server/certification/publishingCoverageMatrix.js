/**
 * Content-type aware publishing coverage matrix.
 * Distinguishes provider API support vs ReGeneLuxe implementation vs credential vs cert.
 * Does not invent GREEN. Does not perform provider writes.
 */

export const COVERAGE_STATES = Object.freeze([
  "SUPPORTED_BY_PROVIDER_API",
  "SUPPORTED_BY_REGENELUXE",
  "CURRENT_CREDENTIAL_AUTHORIZED",
  "CERTIFIED",
  "BLOCKED_EXTERNAL",
]);

export const CONTENT_PRIMITIVES = Object.freeze([
  "TEXT",
  "IMAGE",
  "MULTI_IMAGE",
  "CAROUSEL",
  "VIDEO",
  "SHORT_VIDEO",
  "LONG_VIDEO",
  "STORY",
  "DOCUMENT",
  "ARTICLE_LINK",
  "POLL",
]);

/**
 * Honest baseline rows for release-critical + follow-on providers.
 * Update when adapters land or external approvals change.
 */
export const PUBLISHING_COVERAGE_BASELINE = Object.freeze([
  // YouTube
  row("youtube", "LONG_VIDEO_PRIVATE", { providerApi: true, regeneluxe: true, notes: "Default safe path; upload helper privacy=private" }),
  row("youtube", "LONG_VIDEO_UNLISTED", { providerApi: true, regeneluxe: true, notes: "uploadYouTubeVideo accepts unlisted" }),
  row("youtube", "LONG_VIDEO_PUBLIC", { providerApi: true, regeneluxe: true, notes: "No artificial private-only code restriction" }),
  row("youtube", "LONG_VIDEO_SCHEDULED", { providerApi: true, regeneluxe: true, notes: "publishAt for private→public schedule" }),
  row("youtube", "SHORT_VIDEO", { providerApi: true, regeneluxe: "partial", notes: "Same upload API; no Shorts-specific labeling yet — ENGINEERING GAP" }),
  row("youtube", "THUMBNAIL_TAGS_CATEGORY", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP" }),
  // Instagram
  row("instagram", "IMAGE", { providerApi: true, regeneluxe: true, notes: "Requires public media staging" }),
  row("instagram", "CAROUSEL", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP" }),
  row("instagram", "REEL", { providerApi: true, regeneluxe: true, notes: "Graph video/Reel path; needs public media + cert" }),
  row("instagram", "STORY", { providerApi: "limited", regeneluxe: false, notes: "Confirm current Graph Story publish; do not pretend" }),
  // Facebook
  row("facebook", "TEXT", { providerApi: true, regeneluxe: true, notes: "Page feed" }),
  row("facebook", "IMAGE", { providerApi: true, regeneluxe: true, notes: "Page media" }),
  row("facebook", "VIDEO", { providerApi: true, regeneluxe: "partial", notes: "Verify Page video path — audit before claiming full" }),
  row("facebook", "REEL", { providerApi: true, regeneluxe: "partial", notes: "ENGINEERING GAP until verified" }),
  row("facebook", "STORY", { providerApi: "limited", regeneluxe: false, notes: "Confirm API" }),
  row("facebook", "ARTICLE_LINK", { providerApi: true, regeneluxe: "partial", notes: "ENGINEERING GAP if link-only path incomplete" }),
  // TikTok
  row("tiktok", "VIDEO_DIRECT", { providerApi: true, regeneluxe: false, blockedExternal: "until Content Posting API approval", notes: "Identity ≠ publish" }),
  row("tiktok", "PHOTO", { providerApi: true, regeneluxe: false, blockedExternal: "until Content Posting API approval", notes: "" }),
  row("tiktok", "DRAFT_UPLOAD", { providerApi: true, regeneluxe: false, blockedExternal: "until Content Posting API approval", notes: "" }),
  // LinkedIn
  row("linkedin", "TEXT", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP / product access" }),
  row("linkedin", "IMAGE", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP / product access" }),
  row("linkedin", "VIDEO", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP / product access" }),
  row("linkedin", "DOCUMENT", { providerApi: true, regeneluxe: false, notes: "ENGINEERING GAP / product access" }),
]);

function row(provider, contentType, {
  providerApi = false,
  regeneluxe = false,
  blockedExternal = null,
  notes = "",
} = {}) {
  return Object.freeze({
    provider,
    contentType,
    SUPPORTED_BY_PROVIDER_API: providerApi === true || providerApi === "limited" ? providerApi : Boolean(providerApi),
    SUPPORTED_BY_REGENELUXE: regeneluxe === true ? true : regeneluxe === "partial" ? "partial" : false,
    BLOCKED_EXTERNAL: blockedExternal || null,
    notes,
  });
}

/**
 * @param {{
 *   credentialAuthorizedByProvider?: Record<string, boolean>,
 *   certifiedByKey?: Record<string, boolean>,
 * }} [live]
 */
export function buildPublishingCoverageMatrix(live = {}) {
  const credentialAuthorizedByProvider = live.credentialAuthorizedByProvider || {};
  const certifiedByKey = live.certifiedByKey || {};

  const rows = PUBLISHING_COVERAGE_BASELINE.map((base) => {
    const key = `${base.provider}::${base.contentType}`;
    const cred = Boolean(credentialAuthorizedByProvider[base.provider]);
    const certified = Boolean(certifiedByKey[key]);
    const engineeringGap = base.SUPPORTED_BY_PROVIDER_API
      && base.SUPPORTED_BY_PROVIDER_API !== false
      && base.SUPPORTED_BY_REGENELUXE !== true
      && !base.BLOCKED_EXTERNAL;

    let releaseStatus = "RED";
    if (base.BLOCKED_EXTERNAL) releaseStatus = "BLOCKED_EXTERNAL";
    else if (certified && base.SUPPORTED_BY_REGENELUXE === true && cred) releaseStatus = "GREEN";
    else if (base.SUPPORTED_BY_REGENELUXE === true || base.SUPPORTED_BY_REGENELUXE === "partial") releaseStatus = "YELLOW";

    return {
      ...base,
      key,
      CURRENT_CREDENTIAL_AUTHORIZED: cred,
      CERTIFIED: certified,
      ENGINEERING_GAP: Boolean(engineeringGap),
      releaseStatus,
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    primitives: [...CONTENT_PRIMITIVES],
    dimensions: [...COVERAGE_STATES],
    rows,
    warRoomPriority: [
      "youtube::LONG_VIDEO_PRIVATE",
      "youtube::LONG_VIDEO_SCHEDULED",
      "youtube::LONG_VIDEO_PUBLIC",
      "instagram::REEL",
      "instagram::IMAGE",
      "instagram::CAROUSEL",
      "facebook::IMAGE",
      "facebook::VIDEO",
      "facebook::REEL",
      "tiktok::VIDEO_DIRECT",
    ],
    note: "One content-type GREEN does not make the provider GREEN. CERTIFIED requires controlled real TEST proof.",
  };
}
