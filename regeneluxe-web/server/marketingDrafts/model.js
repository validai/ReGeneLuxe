import { createHash, randomBytes } from "node:crypto";

export const DRAFT_KIND = "MARKETING_DRAFT";
export const APPROVAL_KIND = "MARKETING_DRAFT_APPROVAL";

export const DRAFT_STATUSES = Object.freeze([
  "DRAFT",
  "READY_FOR_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SKIPPED",
  "EXPIRED",
]);

export const APPROVAL_STATUSES = Object.freeze([
  "NONE",
  "PENDING",
  "CHANGES_REQUESTED",
  "APPROVED",
  "SKIPPED",
  "EXPIRED",
  "INVALIDATED",
]);

export const GATE_TYPES = Object.freeze([
  "ALBUM_VERIFIED_LIVE",
  "SMART_LINK_TESTED",
  "YOUTUBE_VIDEO_PUBLIC",
  "FOCUS_SONG_TITLE_CONFIRMED",
  "FOCUS_SONG_AUDIO_APPROVED",
  "MEDIA_FINAL_APPROVED",
]);

export const GATE_STATES = Object.freeze(["UNKNOWN", "BLOCKED", "READY"]);

export const ASSET_STATES = Object.freeze(["DRAFT_ASSET", "FINAL", "APPROVED_FOR_CAMPAIGN"]);

export const OUT_NOW_PATTERN = /\b(out now|listen now|stream now)\b/i;

export function createDraftId() {
  return `mdraft_${randomBytes(10).toString("hex")}`;
}

export function createApprovalId() {
  return `mdap_${randomBytes(10).toString("hex")}`;
}

export function normalizeGateList(values) {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map((item) => String(item || "").trim().toUpperCase()).filter((item) => GATE_TYPES.includes(item)))];
}

export function emptyGate(type, state = "UNKNOWN") {
  return {
    type,
    state: GATE_STATES.includes(state) ? state : "UNKNOWN",
  };
}

/**
 * Durable fingerprint for schedule-bound marketing approval.
 * Distinct from the ephemeral 15-minute publish approval fingerprint.
 */
export function draftApprovalFingerprint(draft = {}) {
  const mediaRefs = Array.isArray(draft.mediaRefs)
    ? draft.mediaRefs.map((item) => (typeof item === "string" ? item : item?.id || item?.mediaId || "")).filter(Boolean).sort()
    : [];
  const payload = JSON.stringify({
    id: draft.id || "",
    caption: String(draft.caption || ""),
    title: String(draft.title || ""),
    description: String(draft.description || ""),
    mediaRefs,
    heroAssetId: String(draft.heroAssetId || ""),
    destinationAccountId: String(draft.destinationAccountId || ""),
    platform: String(draft.platform || ""),
    scheduledFor: String(draft.scheduledFor || ""),
    contentType: String(draft.contentType || ""),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function detectOutNowCopy(text = "") {
  return OUT_NOW_PATTERN.test(String(text || ""));
}

export function emptyMarketingDraft(partial = {}) {
  const now = new Date().toISOString();
  const requiredGates = normalizeGateList(
    partial.requiredGates
      || [
        ...(partial.requiresAlbumLive ? ["ALBUM_VERIFIED_LIVE"] : []),
        ...(partial.requiresSmartLink ? ["SMART_LINK_TESTED"] : []),
      ],
  );
  const gateStates = Array.isArray(partial.releaseGates)
    ? partial.releaseGates.map((gate) => emptyGate(gate.type || gate, gate.state))
    : requiredGates.map((type) => emptyGate(type, "UNKNOWN"));

  return {
    id: partial.id || createDraftId(),
    kind: DRAFT_KIND,
    workspaceId: partial.workspaceId || partial.managedProfileId || null,
    managedProfileId: partial.managedProfileId || partial.workspaceId || null,
    campaignId: partial.campaignId || "",
    createdByType: partial.createdByType || "EXTERNAL_AGENT",
    createdByAgentSessionId: partial.createdByAgentSessionId || null,
    createdByAgentName: partial.createdByAgentName || "",
    createdByAgentRole: partial.createdByAgentRole || "CONTENT_OPERATOR",
    createdByInstanceId: partial.createdByInstanceId || "",
    sourceProposalId: partial.sourceProposalId || null,
    platform: partial.platform || "",
    destinationAccountId: partial.destinationAccountId || "",
    contentType: partial.contentType || partial.format || "",
    title: String(partial.title || "").slice(0, 240),
    caption: String(partial.caption || "").slice(0, 8000),
    description: String(partial.description || "").slice(0, 8000),
    cta: String(partial.cta || "").slice(0, 500),
    hashtags: Array.isArray(partial.hashtags) ? partial.hashtags.map(String).slice(0, 40) : [],
    mediaRefs: Array.isArray(partial.mediaRefs)
      ? partial.mediaRefs.map((item) => (typeof item === "string" ? item : String(item?.id || item?.mediaId || ""))).filter(Boolean).slice(0, 20)
      : [],
    heroAssetId: partial.heroAssetId || null,
    requestedScheduledFor: partial.requestedScheduledFor || partial.requestedSchedule || null,
    scheduledFor: partial.scheduledFor || null,
    timezone: partial.timezone || "America/New_York",
    priority: partial.priority || "NORMAL",
    status: DRAFT_STATUSES.includes(partial.status) ? partial.status : "DRAFT",
    readiness: partial.readiness || "UNKNOWN",
    approvalStatus: APPROVAL_STATUSES.includes(partial.approvalStatus) ? partial.approvalStatus : "NONE",
    approvalDeadline: partial.approvalDeadline || null,
    approvalId: partial.approvalId || null,
    releaseGateState: partial.releaseGateState || summarizeGateState(gateStates),
    releaseGates: gateStates,
    requiresAlbumLive: Boolean(partial.requiresAlbumLive) || requiredGates.includes("ALBUM_VERIFIED_LIVE"),
    requiresSmartLink: Boolean(partial.requiresSmartLink) || requiredGates.includes("SMART_LINK_TESTED"),
    outNowFlag: Boolean(partial.outNowFlag) || detectOutNowCopy(`${partial.caption || ""} ${partial.title || ""} ${partial.description || ""}`),
    providerReadiness: partial.providerReadiness || null,
    creativeApprovalState: partial.creativeApprovalState || null,
    scheduleAssignedBy: partial.scheduleAssignedBy || null,
    scheduleAssignedAt: partial.scheduleAssignedAt || null,
    operatorNotes: String(partial.operatorNotes || "").slice(0, 2000),
    provenance: "MARKETING_AGENT",
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
  };
}

export function summarizeGateState(gates = []) {
  if (!gates.length) return "READY";
  if (gates.some((gate) => gate.state === "BLOCKED")) return "BLOCKED";
  if (gates.some((gate) => gate.state === "UNKNOWN")) return "UNKNOWN";
  return "READY";
}

export function evaluateOutNowGuard(draft) {
  const copy = `${draft.title || ""} ${draft.caption || ""} ${draft.description || ""}`;
  const flagged = detectOutNowCopy(copy) || draft.outNowFlag;
  if (!flagged) return { flagged: false, blocking: false, issues: [] };
  const issues = [];
  if (draft.requiresAlbumLive || (draft.releaseGates || []).some((g) => g.type === "ALBUM_VERIFIED_LIVE")) {
    const gate = (draft.releaseGates || []).find((g) => g.type === "ALBUM_VERIFIED_LIVE");
    if (!gate || gate.state !== "READY") issues.push("OUT_NOW_REQUIRES_ALBUM_VERIFIED_LIVE");
  }
  if (draft.requiresSmartLink || (draft.releaseGates || []).some((g) => g.type === "SMART_LINK_TESTED")) {
    const gate = (draft.releaseGates || []).find((g) => g.type === "SMART_LINK_TESTED");
    if (!gate || gate.state !== "READY") issues.push("OUT_NOW_REQUIRES_SMART_LINK_TESTED");
  }
  if (!(draft.requiresAlbumLive || draft.requiresSmartLink || (draft.releaseGates || []).length)) {
    issues.push("OUT_NOW_COPY_MISSING_REQUIRED_GATES");
  }
  return { flagged: true, blocking: issues.length > 0, issues };
}

/**
 * Future scheduled-publishing eligibility. Never dispatches providers.
 */
export function scheduledPublishEligibility(draft, { providerReady = false } = {}) {
  const creativeApproved = draft.approvalStatus === "APPROVED" && draft.status === "APPROVED";
  const scheduleAssigned = Boolean(draft.scheduledFor);
  const gatesReady = draft.releaseGateState === "READY" || !(draft.releaseGates || []).length;
  const eligible = creativeApproved && scheduleAssigned && providerReady && gatesReady;
  return {
    CREATIVE_APPROVED: creativeApproved,
    SCHEDULE_ASSIGNED: scheduleAssigned,
    PROVIDER_READY: providerReady,
    RELEASE_GATES_READY: gatesReady,
    ELIGIBLE_FOR_SCHEDULED_PUBLISH: eligible,
    note: "Eligibility only. Automatic provider dispatch is not enabled in this sprint.",
  };
}

export function publicDraft(draft) {
  if (!draft) return null;
  return {
    ...draft,
    // Never expose filesystem paths if somehow present.
    mediaRefs: (draft.mediaRefs || []).map((id) => String(id)).filter((id) => !id.includes("/") && !id.includes("\\")),
  };
}
