import { CAMPAIGN_TABS, CONNECTION_STATES, PUBLISH_PERMISSIONS, AI_MODES, LEGACY_SECTION_MAP, emptyInterpretation } from "./domain.js";
import { createId, nowIso } from "./ids.js";

export { createId, nowIso } from "./ids.js";

export const SCHEMA_VERSION = 4;

export const PLATFORMS = [
  "Instagram",
  "YouTube",
  "TikTok",
  "X",
  "Threads",
  "Facebook",
  "SoundCloud",
  "LinkedIn",
  "Other",
];

export const ASSET_TYPES = [
  "feed post",
  "Reel / short video",
  "Story",
  "YouTube video",
  "YouTube Short",
  "TikTok",
  "image",
  "carousel",
  "teaser",
  "trailer",
  "audio",
  "link post",
  "other",
];

export const ASSET_STATUSES = [
  "IDEA",
  "PLANNED",
  "CREATING",
  "READY",
  "PUBLISHED",
  "SKIPPED",
];

export const ASSET_STATUS_OPTIONS = [
  { value: "IDEA", label: "Idea" },
  { value: "PLANNED", label: "Planned" },
  { value: "CREATING", label: "Creating" },
  { value: "READY", label: "Ready" },
  { value: "PUBLISHED", label: "Published" },
  { value: "SKIPPED", label: "Skipped" },
];

export const RESULT_METRIC_KEYS = [
  "views",
  "reach",
  "impressions",
  "likes",
  "comments",
  "shares",
  "saves",
  "clicks",
  "followersGained",
  "watchTime",
  "streams",
  "conversions",
  "other",
];

export const PLATFORM_METRICS = {
  Instagram: ["views", "reach", "impressions", "likes", "comments", "shares", "saves", "followersGained"],
  YouTube: ["views", "likes", "comments", "shares", "watchTime", "followersGained"],
  TikTok: ["views", "likes", "comments", "shares", "saves", "followersGained"],
  X: ["views", "impressions", "likes", "comments", "shares", "clicks", "followersGained"],
  Threads: ["views", "likes", "comments", "shares", "followersGained"],
  Facebook: ["reach", "impressions", "likes", "comments", "shares", "clicks", "followersGained"],
  SoundCloud: ["plays", "likes", "comments", "shares", "streams"],
  LinkedIn: ["impressions", "likes", "comments", "shares", "clicks", "followersGained"],
  Other: RESULT_METRIC_KEYS,
};

export const CURRENT_SECTIONS = CAMPAIGN_TABS.map((item) => item.id);

export function emptyPromoted() {
  return {
    primary: "",
    supporting: [],
    title: "",
    url: "",
    releaseDate: "",
    description: "",
    other: "",
  };
}

export function emptyAudience() {
  return {
    relationships: [],
    ageRanges: [],
    geography: [],
    geographyCustom: "",
    interests: [],
    interestTags: [],
    interestsOther: "",
  };
}

export function emptyIntake() {
  return {
    goals: [],
    goalsOther: "",
    promoted: emptyPromoted(),
    audience: emptyAudience(),
    accountIds: [],
    platformTargets: [],
    contentFormats: [],
    contentFormatsOther: "",
    creative: { tone: [], toneOther: "", visual: [], visualOther: "" },
    messaging: { cta: "", ctaCustom: "", themes: [], themesOther: "", keyMessage: "" },
    strategy: [],
    strategyOther: "",
    availableAssets: [],
    availableAssetsOther: "",
    availableAssetsNotes: "",
    constraints: [],
    constraintsOther: "",
    constraintsNotes: "",
    success: { primary: "", secondary: [], targetValues: {}, other: "" },
    testing: { hypotheses: [], hypothesisText: "", other: "" },
    advanced: {
      startDate: "",
      endDate: "",
      budget: "",
      timezone: "",
      postingFrequency: "",
      contentCadence: "",
      geoNotes: "",
      paidNotes: "",
      retargetingNotes: "",
      platformRestrictions: "",
      internalNotes: "",
    },
    notes: "",
    projectContext: "",
    objective: "",
    offer: "",
    keyMessage: "",
  };
}

export function mergeIntake(current = {}, patch = {}) {
  const base = emptyIntake();
  const a = { ...base, ...current };
  return {
    ...a,
    ...patch,
    promoted: { ...base.promoted, ...a.promoted, ...(patch.promoted || {}) },
    audience: { ...base.audience, ...a.audience, ...(patch.audience || {}) },
    creative: { ...base.creative, ...a.creative, ...(patch.creative || {}) },
    messaging: { ...base.messaging, ...a.messaging, ...(patch.messaging || {}) },
    success: {
      ...base.success,
      ...a.success,
      ...(patch.success || {}),
      targetValues: {
        ...base.success.targetValues,
        ...(a.success?.targetValues || {}),
        ...(patch.success?.targetValues || {}),
      },
    },
    testing: { ...base.testing, ...a.testing, ...(patch.testing || {}) },
    advanced: { ...base.advanced, ...a.advanced, ...(patch.advanced || {}) },
  };
}

export function emptyCreativeDirection() {
  return { tone: "", visual: "", approach: "" };
}

export function emptyBlueprint() {
  return {
    objective: "",
    audience: "",
    coreMessage: "",
    primaryAction: "",
    supportingMessages: "",
    creativeDirection: emptyCreativeDirection(),
    campaignStructure: "",
    channelStrategy: "",
    contentFormats: "",
    assetRequirements: "",
    testingHypotheses: "",
    successCriteria: "",
    edited: {},
  };
}

export function emptyIteration() {
  return {
    whatWorked: "",
    whatDidnt: "",
    whatWeLearned: "",
    whatToChange: "",
    whatToRepeat: "",
    nextTest: "",
  };
}

export function emptyCampaign(partial = {}) {
  const timestamp = nowIso();
  return {
    id: partial.id || createId("cmp"),
    name: partial.name || "Untitled campaign",
    objective: partial.objective || "",
    active: typeof partial.active === "boolean" ? partial.active : true,
    currentSection: CURRENT_SECTIONS.includes(partial.currentSection)
      ? partial.currentSection
      : (LEGACY_SECTION_MAP[partial.currentSection] || "OVERVIEW"),
    aiMode: AI_MODES.includes(partial.aiMode) ? partial.aiMode : "ASSISTED",
    interpretation: { ...emptyInterpretation(), ...(partial.interpretation || {}) },
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
    startDate: partial.startDate || "",
    endDate: partial.endDate || "",
    notes: partial.notes || "",
    accountIds: Array.isArray(partial.accountIds) ? partial.accountIds : [],
    intake: mergeIntake(emptyIntake(), partial.intake || {}),
    blueprint: {
      ...emptyBlueprint(),
      ...(partial.blueprint || {}),
      creativeDirection: {
        ...emptyCreativeDirection(),
        ...(partial.blueprint?.creativeDirection || {}),
      },
      edited: { ...(partial.blueprint?.edited || {}) },
    },
    assets: Array.isArray(partial.assets) ? partial.assets : [],
    results: Array.isArray(partial.results) ? partial.results : [],
    iteration: { ...emptyIteration(), ...(partial.iteration || {}) },
    targeting: partial.targeting || {
      ageRange: { min: null, max: null },
      geoType: null,
      locations: [],
      interests: "",
      targetingStyle: null,
    },
    platforms: Array.isArray(partial.platforms) ? partial.platforms : [],
    website: partial.website || "",
    timezone: partial.timezone || "",
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptyAsset(partial = {}) {
  return {
    id: partial.id || createId("ast"),
    name: partial.name || "",
    contentType: partial.contentType || "feed post",
    accountId: partial.accountId || "",
    campaignRole: partial.campaignRole || "",
    status: partial.status || "IDEA",
    plannedPublishDate: partial.plannedPublishDate || "",
    actualPublishDate: partial.actualPublishDate || "",
    cta: partial.cta || "",
    messageAngle: partial.messageAngle || "",
    sourceRef: partial.sourceRef || "",
    notes: partial.notes || "",
  };
}

export function emptyResult(partial = {}) {
  return {
    id: partial.id || createId("res"),
    assetId: partial.assetId || "",
    accountId: partial.accountId || "",
    recordedAt: partial.recordedAt || nowIso(),
    metrics: { ...(partial.metrics || {}) },
    notes: {
      whatWorked: "",
      whatFailed: "",
      unexpected: "",
      audienceResponse: "",
      timingIssue: "",
      creativeIssue: "",
      platformIssue: "",
      lesson: "",
      ...(partial.notes || {}),
    },
  };
}

export function emptyAccount(partial = {}) {
  const timestamp = nowIso();
  const active = typeof partial.active === "boolean"
    ? partial.active
    : partial.status !== "inactive";
  return {
    id: partial.id || createId("acc"),
    platform: partial.platform || "Instagram",
    displayName: partial.displayName || "",
    handle: partial.handle || "",
    profileUrl: partial.profileUrl || "",
    purpose: partial.purpose || "",
    active,
    followerCount: partial.followerCount ?? "",
    notes: partial.notes || "",
    connectionMethod: partial.connectionMethod || "MANUAL",
    providerAccountId: partial.providerAccountId || "",
    connectionState: CONNECTION_STATES.includes(partial.connectionState)
      ? partial.connectionState
      : (partial.connectionMethod === "MANUAL" || !partial.connectionMethod ? "MANUAL_ONLY" : "UNCONNECTED"),
    lastSync: partial.lastSync || partial.lastSuccessfulSync || "",
    lastSuccessfulSync: partial.lastSuccessfulSync || partial.lastSync || "",
    analyticsFreshness: partial.analyticsFreshness || "",
    lastErrorSummary: partial.lastErrorSummary || partial.connectionError || "",
    connectionError: partial.connectionError || partial.lastErrorSummary || "",
    publishPermission: PUBLISH_PERMISSIONS.includes(partial.publishPermission)
      ? partial.publishPermission
      : "APPROVAL_REQUIRED",
    lastMetricsUpdate: partial.lastMetricsUpdate || "",
    campaignRole: partial.campaignRole || "",
    role: partial.role || partial.campaignRole || "",
    primaryContentType: partial.primaryContentType || "",
    audienceNotes: partial.audienceNotes || "",
    platformStrengths: partial.platformStrengths || "",
    platformWeaknesses: partial.platformWeaknesses || "",
    postingNotes: partial.postingNotes || "",
    typicalFormats: Array.isArray(partial.typicalFormats) ? partial.typicalFormats : [],
    defaultCta: partial.defaultCta || "",
    createdAt: partial.createdAt || timestamp,
    updatedAt: partial.updatedAt || timestamp,
    managedProfileId: partial.managedProfileId || null,
  };
}

export function emptySettings(partial = {}) {
  return {
    id: partial.id || "app",
    defaultPlatforms: Array.isArray(partial.defaultPlatforms) ? partial.defaultPlatforms : [],
    theme: partial.theme || "dark",
    aiMode: AI_MODES.includes(partial.aiMode) ? partial.aiMode : "ASSISTED",
    schemaVersion: SCHEMA_VERSION,
  };
}

export function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasList(value) {
  return Array.isArray(value) && value.length > 0;
}

export function intakeHasContent(intake) {
  if (!intake || typeof intake !== "object") return false;
  return (
    hasList(intake.goals) ||
    hasText(intake.promoted?.title) ||
    hasText(intake.promoted?.primary) ||
    hasList(intake.audience?.relationships) ||
    hasList(intake.accountIds) ||
    hasList(intake.contentFormats) ||
    hasList(intake.creative?.tone) ||
    hasText(intake.messaging?.cta) ||
    hasList(intake.strategy) ||
    hasText(intake.success?.primary) ||
    hasText(intake.objective) ||
    hasText(intake.offer)
  );
}

export function blueprintHasContent(blueprint) {
  if (!blueprint || typeof blueprint !== "object") return false;
  const direction = blueprint.creativeDirection || {};
  return [
    blueprint.objective,
    blueprint.audience,
    blueprint.coreMessage,
    blueprint.primaryAction,
    blueprint.supportingMessages,
    direction.tone,
    direction.visual,
    direction.approach,
    blueprint.campaignStructure,
    blueprint.channelStrategy,
    blueprint.contentFormats,
    blueprint.assetRequirements,
    blueprint.testingHypotheses,
    blueprint.successCriteria,
  ].some(hasText);
}

export function iterationHasContent(iteration) {
  if (!iteration || typeof iteration !== "object") return false;
  return Object.values(iteration).some(hasText);
}
