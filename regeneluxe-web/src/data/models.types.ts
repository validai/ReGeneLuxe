/**
 * Sprint 92 — TypeScript interfaces mirroring `models.js` factories.
 * Runtime remains JS; these types document the domain shape for gradual TS conversion.
 * Keep in sync with empty* helpers in models.js / domain.js.
 */

export type Platform =
  | "Instagram"
  | "YouTube"
  | "TikTok"
  | "X"
  | "Threads"
  | "Facebook"
  | "SoundCloud"
  | "LinkedIn"
  | "Other"
  | (string & {});

export type AssetType =
  | "feed post"
  | "Reel / short video"
  | "Story"
  | "YouTube video"
  | "YouTube Short"
  | "TikTok"
  | "image"
  | "carousel"
  | "teaser"
  | "trailer"
  | "audio"
  | "link post"
  | "other"
  | (string & {});

export type AssetStatus =
  | "IDEA"
  | "PLANNED"
  | "CREATING"
  | "READY"
  | "PUBLISHED"
  | "SKIPPED"
  | (string & {});

export type ConnectionState =
  | "MANUAL_ONLY"
  | "UNCONNECTED"
  | "CONNECTING"
  | "CONNECTED"
  | "AUTH_EXPIRED"
  | "ERROR"
  | "DISCONNECTED"
  | (string & {});

export type PublishPermission =
  | "ANALYZE_ONLY"
  | "DRAFT_ONLY"
  | "APPROVAL_REQUIRED"
  | "AUTO_PUBLISH"
  | (string & {});

export type AiMode = "ADVISORY" | "ASSISTED" | "AUTOPILOT" | (string & {});

export type CampaignSection =
  | "OVERVIEW"
  | "STRATEGY"
  | "CONTENT"
  | "CALENDAR"
  | "ANALYTICS"
  | (string & {});

export type ResultMetricKey =
  | "views"
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "clicks"
  | "followersGained"
  | "watchTime"
  | "streams"
  | "conversions"
  | "other"
  | "plays"
  | (string & {});

export interface Promoted {
  primary: string;
  supporting: string[];
  title: string;
  url: string;
  releaseDate: string;
  description: string;
  other: string;
}

export interface Audience {
  relationships: string[];
  ageRanges: string[];
  geography: string[];
  geographyCustom: string;
  interests: string[];
  interestTags: string[];
  interestsOther: string;
}

export interface IntakeCreative {
  tone: string[];
  toneOther: string;
  visual: string[];
  visualOther: string;
}

export interface IntakeMessaging {
  cta: string;
  ctaCustom: string;
  themes: string[];
  themesOther: string;
  keyMessage: string;
}

export interface IntakeSuccess {
  primary: string;
  secondary: string[];
  targetValues: Record<string, string | number>;
  other: string;
}

export interface IntakeTesting {
  hypotheses: string[];
  hypothesisText: string;
  other: string;
}

export interface IntakeAdvanced {
  startDate: string;
  endDate: string;
  budget: string;
  timezone: string;
  postingFrequency: string;
  contentCadence: string;
  geoNotes: string;
  paidNotes: string;
  retargetingNotes: string;
  platformRestrictions: string;
  internalNotes: string;
}

export interface CampaignIntake {
  goals: string[];
  goalsOther: string;
  promoted: Promoted;
  audience: Audience;
  accountIds: string[];
  platformTargets: string[];
  contentFormats: string[];
  contentFormatsOther: string;
  creative: IntakeCreative;
  messaging: IntakeMessaging;
  strategy: string[];
  strategyOther: string;
  availableAssets: string[];
  availableAssetsOther: string;
  availableAssetsNotes: string;
  constraints: string[];
  constraintsOther: string;
  constraintsNotes: string;
  success: IntakeSuccess;
  testing: IntakeTesting;
  advanced: IntakeAdvanced;
  notes: string;
  projectContext: string;
  objective: string;
  offer: string;
  keyMessage: string;
}

export interface CreativeDirection {
  tone: string;
  visual: string;
  approach: string;
}

export interface CampaignBlueprint {
  objective: string;
  audience: string;
  coreMessage: string;
  primaryAction: string;
  supportingMessages: string;
  creativeDirection: CreativeDirection;
  campaignStructure: string;
  channelStrategy: string;
  contentFormats: string;
  assetRequirements: string;
  testingHypotheses: string;
  successCriteria: string;
  edited: Record<string, boolean>;
}

export interface CampaignIteration {
  whatWorked: string;
  whatDidnt: string;
  whatWeLearned: string;
  whatToChange: string;
  whatToRepeat: string;
  nextTest: string;
}

export interface CampaignInterpretation {
  winningPlatform: string;
  winningContent: string;
  winningFormat: string;
  winningCreative: string;
  winningCta: string;
  failedApproach: string;
  successfulHypothesis: string;
  failedHypothesis: string;
  lessons: string;
  recommendations: string;
  source: string;
}

export interface CampaignTargeting {
  ageRange: { min: number | null; max: number | null };
  geoType: string | null;
  locations: string[];
  interests: string;
  targetingStyle: string | null;
}

export interface CampaignAsset {
  id: string;
  name: string;
  contentType: AssetType;
  accountId: string;
  campaignRole: string;
  status: AssetStatus;
  plannedPublishDate: string;
  actualPublishDate: string;
  cta: string;
  messageAngle: string;
  sourceRef: string;
  notes: string;
}

export interface ResultNotes {
  whatWorked: string;
  whatFailed: string;
  unexpected: string;
  audienceResponse: string;
  timingIssue: string;
  creativeIssue: string;
  platformIssue: string;
  lesson: string;
}

export interface CampaignResult {
  id: string;
  assetId: string;
  accountId: string;
  recordedAt: string;
  metrics: Partial<Record<ResultMetricKey, number | string>>;
  notes: ResultNotes;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  active: boolean;
  currentSection: CampaignSection;
  aiMode: AiMode;
  interpretation: CampaignInterpretation;
  createdAt: string;
  updatedAt: string;
  startDate: string;
  endDate: string;
  notes: string;
  accountIds: string[];
  intake: CampaignIntake;
  blueprint: CampaignBlueprint;
  assets: CampaignAsset[];
  results: CampaignResult[];
  iteration: CampaignIteration;
  targeting: CampaignTargeting;
    platforms: Platform[];
    website: string;
    timezone: string;
    managedProfileId?: string | null;
}

export interface Account {
  id: string;
  platform: Platform;
  displayName: string;
  handle: string;
  profileUrl: string;
  purpose: string;
  active: boolean;
  followerCount: number | string;
  notes: string;
  connectionMethod: string;
  providerAccountId: string;
  connectionState: ConnectionState;
  lastSync: string;
  analyticsFreshness: string;
  connectionError: string;
  publishPermission: PublishPermission;
  lastMetricsUpdate: string;
  campaignRole: string;
  role: string;
  primaryContentType: string;
  audienceNotes: string;
  platformStrengths: string;
  platformWeaknesses: string;
  postingNotes: string;
  typicalFormats: string[];
  defaultCta: string;
  createdAt: string;
  updatedAt: string;
  managedProfileId?: string | null;
}

export interface AppSettings {
  defaultPlatforms: Platform[];
  theme: string;
  aiMode: AiMode;
  schemaVersion: number;
}

export interface Operator {
  id: string;
  googleSub: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl: string;
  activeProfileId: string | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string;
}

export interface ManagedProfile {
  id: string;
  ownerOperatorId: string;
  displayName: string;
  slug: string;
  status: "ACTIVE" | "INACTIVE" | (string & {});
  avatarUrl: string;
  avatarMediaId?: string;
  primaryEmail: string;
  website: string | null;
  primaryPublicUrl: string;
  timezone: string;
  shortDescription: string;
  platforms: Platform[];
  createdAt: string;
  updatedAt: string;
}
