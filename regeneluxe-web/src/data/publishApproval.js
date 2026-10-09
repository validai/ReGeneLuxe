/**
 * Fresh, single-use publish approval.
 * AUTO_PUBLISH, READY, and a bare approved boolean are not approval.
 */

export const PILOT_PROVIDERS = Object.freeze([
  "instagram",
  "facebook",
  "threads",
  "youtube",
]);

export const APPROVAL_TTL_MS = 15 * 60 * 1000;

export function isPilotProvider(provider) {
  return PILOT_PROVIDERS.includes(String(provider || "").toLowerCase());
}

export function publishFingerprint({ caption = "", title = "", mediaRef = "", mediaId = "" } = {}) {
  const raw = JSON.stringify({
    caption: String(caption || ""),
    title: String(title || ""),
    mediaId: String(mediaId || ""),
    mediaRef: String(mediaRef || ""),
  });
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = Math.imul(31, hash) + raw.charCodeAt(i);
  }
  return `fp_${(hash >>> 0).toString(16)}_${raw.length}`;
}

export function variantForAccount(content = {}, account = {}) {
  const variants = Array.isArray(content.variants) ? content.variants : [];
  const match = variants.find((variant) => variant.accountId === account.id)
    || variants.find((variant) => String(variant.platform || "").toLowerCase() === String(account.platform || "").toLowerCase());
  const mediaRef = match?.mediaRef
    || content.mediaRefs?.[0]?.url
    || content.mediaRefs?.[0]
    || content.imageUrl
    || content.videoPath
    || "";
  const mediaId = match?.mediaId || content.mediaId || content.mediaRefs?.[0]?.mediaId || "";
  return {
    provider: String(account.platform || match?.platform || "").toLowerCase(),
    accountId: account.id || "",
    caption: match?.caption ?? content.caption ?? "",
    title: match?.title ?? content.title ?? "",
    mediaId: String(mediaId || ""),
    mediaRef: typeof mediaRef === "string" ? mediaRef : (mediaRef?.url || ""),
    privacy: "private",
  };
}

export function buildPublishApproval(input, now = Date.now()) {
  const approvedAt = new Date(now).toISOString();
  return {
    id: input.id,
    operatorId: input.operatorId,
    managedProfileId: input.managedProfileId,
    contentId: input.contentId,
    contentFingerprint: input.contentFingerprint,
    provider: String(input.provider || "").toLowerCase(),
    accountId: input.accountId,
    externalDestinationId: input.externalDestinationId || "",
    mediaId: input.mediaId || "",
    mediaRef: input.mediaRef || "",
    idempotencyKey: input.idempotencyKey || "",
    approvedAt,
    expiresAt: new Date(now + APPROVAL_TTL_MS).toISOString(),
    consumedAt: null,
  };
}

export function explainApprovalRejection(approval, expected, now = Date.now()) {
  if (!approval) return "FRESH_APPROVAL_REQUIRED";
  if (approval.consumedAt) return "APPROVAL_CONSUMED";
  if (Date.parse(approval.expiresAt) <= now) return "APPROVAL_EXPIRED";
  if (expected.operatorId && approval.operatorId !== expected.operatorId) return "APPROVAL_OPERATOR_MISMATCH";
  if (expected.managedProfileId && approval.managedProfileId !== expected.managedProfileId) return "APPROVAL_WORKSPACE_MISMATCH";
  if (approval.contentId !== expected.contentId) return "APPROVAL_CONTENT_MISMATCH";
  if (approval.contentFingerprint !== expected.contentFingerprint) return "APPROVAL_REVISION_MISMATCH";
  if (approval.accountId !== expected.accountId) return "APPROVAL_ACCOUNT_MISMATCH";
  if (String(approval.provider) !== String(expected.provider || "").toLowerCase()) return "APPROVAL_PROVIDER_MISMATCH";
  if ((approval.externalDestinationId || "") !== (expected.externalDestinationId || "")) {
    return "APPROVAL_DESTINATION_MISMATCH";
  }
  if ((approval.mediaId || "") !== (expected.mediaId || "")) return "APPROVAL_MEDIA_MISMATCH";
  if ((approval.mediaRef || "") !== (expected.mediaRef || "")) return "APPROVAL_MEDIA_MISMATCH";
  if (expected.idempotencyKey && approval.idempotencyKey && approval.idempotencyKey !== expected.idempotencyKey) {
    return "APPROVAL_ATTEMPT_MISMATCH";
  }
  return "";
}
