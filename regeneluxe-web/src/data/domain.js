import { createId, nowIso } from "./ids.js";

export const CONNECTION_STATES = [
  "MANUAL_ONLY",
  "UNCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "AUTH_EXPIRED",
  "RECONNECT_REQUIRED",
  "ERROR",
  "UNSUPPORTED",
  "SETUP_REQUIRED",
];

export const CONNECTION_LABELS = {
  MANUAL_ONLY: "Manual",
  UNCONNECTED: "Not connected",
  NOT_CONNECTED: "Not connected",
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  AUTH_EXPIRED: "Reconnect required",
  RECONNECT_REQUIRED: "Reconnect required",
  ERROR: "Reconnect required",
  UNSUPPORTED: "Unsupported",
  SETUP_REQUIRED: "Setup required",
  PROVIDER_REVIEW_REQUIRED: "Provider review required",
};

export const CAPABILITIES = {
  READ_PROFILE: "READ_PROFILE",
  READ_POSTS: "READ_POSTS",
  READ_POST_METRICS: "READ_POST_METRICS",
  READ_ACCOUNT_METRICS: "READ_ACCOUNT_METRICS",
  READ_COMMENTS: "READ_COMMENTS",
  READ_MESSAGES: "READ_MESSAGES",
  CREATE_POST: "CREATE_POST",
  PUBLISH_POST: "PUBLISH_POST",
  SCHEDULE_POST: "SCHEDULE_POST",
  DELETE_POST: "DELETE_POST",
};

export const PUBLISH_PERMISSIONS = [
  "ANALYZE_ONLY",
  "DRAFT_ONLY",
  "APPROVAL_REQUIRED",
  "AUTO_PUBLISH",
];

export const PUBLISH_PERMISSION_LABELS = {
  ANALYZE_ONLY: "Analyze only",
  DRAFT_ONLY: "Draft only",
  APPROVAL_REQUIRED: "Approval required",
  AUTO_PUBLISH: "Auto-publish",
};

export const CONTENT_STATUSES = [
  "IDEA",
  "PLANNED",
  "DRAFTING",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "SKIPPED",
];

export const CONTENT_STATUS_LABELS = {
  IDEA: "Idea",
  PLANNED: "Draft",
  DRAFTING: "Draft",
  READY: "Ready",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export const INTERACTION_TYPES = ["comment", "mention", "reply", "message", "review"];

export const METRIC_SOURCES = ["PROVIDER", "MANUAL", "CALCULATED", "AI_INTERPRETATION"];

export const AI_MODES = ["ADVISORY", "ASSISTED", "AUTOPILOT"];

export const AI_MODE_LABELS = {
  ADVISORY: "Advisory",
  ASSISTED: "Assisted",
  AUTOPILOT: "Autopilot",
};

export const CAMPAIGN_TABS = [
  { id: "OVERVIEW", tab: "overview", label: "Overview" },
  { id: "STRATEGY", tab: "strategy", label: "Strategy" },
  { id: "CONTENT", tab: "content", label: "Content" },
  { id: "CALENDAR", tab: "calendar", label: "Calendar" },
  { id: "ANALYTICS", tab: "analytics", label: "Analytics" },
  { id: "RESULTS", tab: "results", label: "Results" },
];

export const LEGACY_SECTION_MAP = {
  INTAKE: "STRATEGY",
  BLUEPRINT: "STRATEGY",
  STRATEGY: "STRATEGY",
  OVERVIEW: "OVERVIEW",
  ASSET_PLANNING: "CONTENT",
  ASSETS: "CONTENT",
  CONTENT: "CONTENT",
  READY_TO_LAUNCH: "CONTENT",
  CALENDAR: "CALENDAR",
  ACTIVE: "ANALYTICS",
  RESULTS: "ANALYTICS",
  LAUNCH_RESULTS: "ANALYTICS",
  ANALYTICS: "ANALYTICS",
  ITERATION: "RESULTS",
  LEARN_ITERATE: "RESULTS",
  COMPLETE: "RESULTS",
  ACTIVITY: "ACTIVITY",
};

export const ANALYTICS_METRICS = [
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "profileVisits",
  "followers",
  "followerGrowth",
  "subscribers",
  "watchTime",
  "averageViewDuration",
  "completionRate",
  "streams",
  "playlistAdds",
  "conversions",
  "engagementRate",
];

export function emptyVariant(partial = {}) {
  return {
    id: partial.id || createId("var"),
    platform: partial.platform || "",
    accountId: partial.accountId || "",
    caption: partial.caption || "",
    title: partial.title || "",
    hashtags: Array.isArray(partial.hashtags) ? partial.hashtags : [],
    cta: partial.cta || "",
    mediaRef: partial.mediaRef || "",
    thumbnail: partial.thumbnail || "",
    length: partial.length || "",
    scheduledAt: partial.scheduledAt || "",
  };
}

export function emptyContentItem(partial = {}) {
  const timestamp = nowIso();
  return {
    id: partial.id || createId("cnt"),
    campaignId: partial.campaignId || "",
    parentId: partial.parentId || "",
    title: partial.title || "",
    concept: partial.concept || "",
    format: partial.format || "",
    caption: partial.caption || "",
    hook: partial.hook || "",
    cta: partial.cta || "",
    mediaRefs: Array.isArray(partial.mediaRefs) ? partial.mediaRefs : [],
    accountIds: Array.isArray(partial.accountIds) ? partial.accountIds : [],
    variants: Array.isArray(partial.variants) ? partial.variants.map(emptyVariant) : [],
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
    status: CONTENT_STATUSES.includes(partial.status) ? partial.status : "IDEA",
    scheduledAt: partial.scheduledAt || "",
    publishedAt: partial.publishedAt || "",
    providerPostIds: partial.providerPostIds || {},
    analyticsIds: Array.isArray(partial.analyticsIds) ? partial.analyticsIds : [],
    provenance: partial.provenance || "MANUAL",
    notes: partial.notes || "",
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyInteraction(partial = {}) {
  return {
    id: partial.id || createId("int"),
    provider: partial.provider || "",
    accountId: partial.accountId || "",
    contentId: partial.contentId || "",
    campaignId: partial.campaignId || "",
    sender: partial.sender || "",
    type: INTERACTION_TYPES.includes(partial.type) ? partial.type : "comment",
    message: partial.message || "",
    timestamp: partial.timestamp || nowIso(),
    read: Boolean(partial.read),
    handled: Boolean(partial.handled),
    sentiment: partial.sentiment || "",
    replyState: partial.replyState || "none",
    source: partial.source || "PROVIDER",
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptySnapshot(partial = {}) {
  return {
    id: partial.id || createId("snap"),
    accountId: partial.accountId || "",
    contentId: partial.contentId || "",
    campaignId: partial.campaignId || "",
    platform: partial.platform || "",
    recordedAt: partial.recordedAt || nowIso(),
    source: METRIC_SOURCES.includes(partial.source) ? partial.source : "MANUAL",
    metrics: { ...(partial.metrics || {}) },
    freshness: partial.freshness || partial.recordedAt || nowIso(),
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyQueueJob(partial = {}) {
  return {
    id: partial.id || createId("job"),
    contentId: partial.contentId || "",
    accountId: partial.accountId || "",
    campaignId: partial.campaignId || "",
    platform: partial.platform || "",
    scheduledAt: partial.scheduledAt || "",
    state: partial.state || "queued",
    retryCount: Number(partial.retryCount) || 0,
    providerResult: partial.providerResult || "",
    failureReason: partial.failureReason || "",
    manualFallback: Boolean(partial.manualFallback),
    createdAt: partial.createdAt || nowIso(),
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyDecision(partial = {}) {
  return {
    id: partial.id || createId("dec"),
    campaignId: partial.campaignId || "",
    decision: partial.decision || "",
    timestamp: partial.timestamp || nowIso(),
    createdAt: partial.createdAt || partial.timestamp || nowIso(),
    updatedAt: partial.updatedAt || nowIso(),
    evidence: partial.evidence || "",
    reason: partial.reason || "",
    affectedContentIds: Array.isArray(partial.affectedContentIds) ? partial.affectedContentIds : [],
    affectedAccountIds: Array.isArray(partial.affectedAccountIds) ? partial.affectedAccountIds : [],
    expectedOutcome: partial.expectedOutcome || "",
    permissionRequired: Boolean(partial.permissionRequired),
    status: partial.status || "proposed",
    actualOutcome: partial.actualOutcome || "",
    outcomeLabel: partial.outcomeLabel || "",
    userResponse: partial.userResponse || "",
    userResponseNote: partial.userResponseNote || "",
    respondedAt: partial.respondedAt || "",
    evaluatedAt: partial.evaluatedAt || "",
    snapshotRef: partial.snapshotRef || "",
    confidence: partial.confidence ?? null,
    evidenceRefs: Array.isArray(partial.evidenceRefs) ? partial.evidenceRefs : [],
    source: partial.source || "AI_INTERPRETATION",
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyActivity(partial = {}) {
  return {
    id: partial.id || createId("act"),
    campaignId: partial.campaignId || "",
    type: partial.type || "note",
    message: partial.message || "",
    timestamp: partial.timestamp || nowIso(),
    source: partial.source || "MANUAL",
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyInterpretation(partial = {}) {
  return {
    winningPlatform: partial.winningPlatform || "",
    winningContent: partial.winningContent || "",
    winningFormat: partial.winningFormat || "",
    winningCreative: partial.winningCreative || "",
    winningCta: partial.winningCta || "",
    failedApproach: partial.failedApproach || "",
    successfulHypothesis: partial.successfulHypothesis || "",
    failedHypothesis: partial.failedHypothesis || "",
    lessons: partial.lessons || "",
    recommendations: partial.recommendations || "",
    source: "MANUAL",
  };
}

export function mapAssetStatus(status) {
  if (status === "CREATING") return "DRAFTING";
  if (CONTENT_STATUSES.includes(status)) return status;
  return "IDEA";
}

export function humanLabel(map, value, fallback = "") {
  return map[value] || fallback || String(value || "").replaceAll("_", " ");
}
