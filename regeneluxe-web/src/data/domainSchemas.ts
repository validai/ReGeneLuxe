import { z } from "zod";

/** Sprint 106 — canonical domain schemas (runtime Zod). */

const IsoDateTime = z.string().min(1);
const Id = z.string().min(1);

export const SyncStatusSchema = z.enum([
  "LOCAL_ONLY",
  "PENDING",
  "SYNCING",
  "SYNCED",
  "ERROR",
  "CONFLICT",
]);

export const RecordMetaSchema = z.object({
  id: Id,
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  schemaVersion: z.number().int().nonnegative().default(1),
  revision: z.number().int().positive().optional(),
  syncStatus: SyncStatusSchema.optional(),
});

export const SocialAccountSchema = RecordMetaSchema.extend({
  platform: z.string().min(1),
  displayName: z.string().optional(),
  handle: z.string().optional(),
  profileUrl: z.string().optional(),
  purpose: z.string().optional(),
  active: z.boolean().optional(),
  followerCount: z.number().optional().nullable(),
  notes: z.string().optional(),
  connectionMethod: z.string().optional(),
  providerAccountId: z.string().optional().nullable(),
  connectionState: z.string().optional(),
  publishPermission: z.string().optional(),
}).passthrough();

export const CampaignStrategySchema = z.object({
  intake: z.record(z.string(), z.unknown()).optional(),
  blueprint: z.record(z.string(), z.unknown()).optional(),
  targeting: z.record(z.string(), z.unknown()).optional(),
  interpretation: z.record(z.string(), z.unknown()).optional(),
}).passthrough();

export const CampaignSchema = RecordMetaSchema.extend({
  name: z.string(),
  objective: z.string().optional(),
  active: z.boolean().optional(),
  currentSection: z.string().optional(),
  aiMode: z.string().optional(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  notes: z.string().optional(),
  accountIds: z.array(z.string()).optional(),
  platforms: z.array(z.string()).optional(),
  website: z.string().optional().nullable(),
  timezone: z.string().optional(),
  intake: z.unknown().optional(),
  blueprint: z.unknown().optional(),
  assets: z.array(z.unknown()).optional(),
  results: z.array(z.unknown()).optional(),
  iteration: z.unknown().optional(),
  targeting: z.unknown().optional(),
}).passthrough();

export const ContentVariantSchema = z.object({
  id: Id.optional(),
  platform: z.string().optional(),
  accountId: z.string().optional().nullable(),
  caption: z.string().optional(),
  scheduledAt: IsoDateTime.optional().nullable(),
}).passthrough();

export const ContentItemSchema = RecordMetaSchema.extend({
  campaignId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
  title: z.string().optional(),
  concept: z.string().optional(),
  format: z.string().optional(),
  caption: z.string().optional(),
  hook: z.string().optional(),
  cta: z.string().optional(),
  mediaRefs: z.array(z.unknown()).optional(),
  accountIds: z.array(z.string()).optional(),
  variants: z.array(ContentVariantSchema).optional(),
  status: z.string().optional(),
  scheduledAt: IsoDateTime.optional().nullable(),
  publishedAt: IsoDateTime.optional().nullable(),
  providerPostIds: z.record(z.string(), z.unknown()).optional(),
  analyticsIds: z.array(z.string()).optional(),
  provenance: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();

export const ScheduledPublicationSchema = RecordMetaSchema.extend({
  contentId: Id,
  accountId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  platform: z.string().optional(),
  scheduledAt: IsoDateTime,
  state: z.string().optional(),
}).passthrough();

export const PublicationAttemptSchema = RecordMetaSchema.extend({
  contentId: Id,
  accountId: z.string().optional().nullable(),
  platform: z.string().optional(),
  idempotencyKey: z.string().min(1),
  state: z.string(),
  providerResult: z.unknown().optional(),
  error: z.string().optional().nullable(),
}).passthrough();

export const MetricSnapshotSchema = RecordMetaSchema.extend({
  campaignId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  platform: z.string().optional(),
  provider: z.string().optional(),
  recordedAt: IsoDateTime.optional(),
  capturedAt: IsoDateTime.optional(),
  providerUpdatedAt: IsoDateTime.optional().nullable(),
  source: z.string().optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  freshness: z.string().optional().nullable(),
}).passthrough();

export const SocialInteractionSchema = RecordMetaSchema.extend({
  provider: z.string().optional(),
  accountId: z.string().optional().nullable(),
  contentId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  sender: z.string().optional(),
  type: z.string().optional(),
  message: z.string().optional(),
  timestamp: IsoDateTime.optional(),
  read: z.boolean().optional(),
  handled: z.boolean().optional(),
  sentiment: z.string().optional().nullable(),
  replyState: z.string().optional(),
  source: z.string().optional(),
}).passthrough();

export const CampaignStateSnapshotSchema = RecordMetaSchema.extend({
  campaignId: Id,
  progressLabel: z.string().optional(),
  payload: z.unknown().optional(),
}).passthrough();

export const CampaignChangeSchema = RecordMetaSchema.extend({
  campaignId: Id,
  field: z.string().optional(),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
  source: z.string().optional(),
}).passthrough();

export const CampaignDecisionSchema = RecordMetaSchema.extend({
  campaignId: z.string().optional().nullable(),
  decision: z.string().optional(),
  evidence: z.unknown().optional(),
  reason: z.string().optional(),
  status: z.string().optional(),
  source: z.string().optional(),
  confidence: z.number().optional().nullable(),
}).passthrough();

export const CampaignExperimentSchema = RecordMetaSchema.extend({
  campaignId: Id,
  name: z.string().optional(),
  hypothesis: z.string().optional(),
  status: z.string().optional(),
  startedAt: IsoDateTime.optional().nullable(),
  endedAt: IsoDateTime.optional().nullable(),
}).passthrough();

export const CampaignResultSchema = RecordMetaSchema.extend({
  campaignId: Id.optional(),
  assetId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  recordedAt: IsoDateTime.optional(),
  metrics: z.record(z.string(), z.unknown()).optional(),
  notes: z.unknown().optional(),
}).passthrough();

export const AttentionItemSchema = RecordMetaSchema.extend({
  tone: z.string().optional(),
  title: z.string().optional(),
  body: z.string().optional(),
  href: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
}).passthrough();

export const ApprovalSchema = RecordMetaSchema.extend({
  contentId: z.string().optional().nullable(),
  campaignId: z.string().optional().nullable(),
  state: z.string().optional(),
  requestedAt: IsoDateTime.optional(),
  resolvedAt: IsoDateTime.optional().nullable(),
}).passthrough();

export const CampaignBrainRunSchema = RecordMetaSchema.extend({
  campaignId: Id,
  status: z.string().optional(),
  inputRef: z.string().optional().nullable(),
  output: z.unknown().optional(),
  error: z.string().optional().nullable(),
}).passthrough();

export const CampaignMonitorRunSchema = RecordMetaSchema.extend({
  campaignId: Id,
  status: z.string().optional(),
  snapshot: z.unknown().optional(),
}).passthrough();

export const JobSchema = z.object({
  id: Id,
  type: z.string().min(1),
  payload: z.unknown(),
  createdAt: IsoDateTime,
  scheduledAt: IsoDateTime,
  startedAt: IsoDateTime.optional().nullable(),
  completedAt: IsoDateTime.optional().nullable(),
  attemptCount: z.number().int().nonnegative(),
  state: z.enum(["PENDING", "RUNNING", "RETRY", "DONE", "FAILED", "CANCELLED"]),
  lastError: z.string().optional().nullable(),
  idempotencyKey: z.string().optional().nullable(),
});

export const AppSettingsSchema = z.object({
  id: z.string().default("app"),
  defaultPlatforms: z.array(z.string()).optional(),
  theme: z.string().optional(),
  aiMode: z.string().optional(),
  schemaVersion: z.number().optional(),
  timezone: z.string().optional(),
  createdAt: IsoDateTime.optional(),
  updatedAt: IsoDateTime.optional(),
}).passthrough();

export const DomainSchemas = {
  Campaign: CampaignSchema,
  SocialAccount: SocialAccountSchema,
  CampaignStrategy: CampaignStrategySchema,
  ContentItem: ContentItemSchema,
  ContentVariant: ContentVariantSchema,
  ScheduledPublication: ScheduledPublicationSchema,
  PublicationAttempt: PublicationAttemptSchema,
  MetricSnapshot: MetricSnapshotSchema,
  SocialInteraction: SocialInteractionSchema,
  CampaignStateSnapshot: CampaignStateSnapshotSchema,
  CampaignChange: CampaignChangeSchema,
  CampaignDecision: CampaignDecisionSchema,
  CampaignExperiment: CampaignExperimentSchema,
  CampaignResult: CampaignResultSchema,
  AttentionItem: AttentionItemSchema,
  Approval: ApprovalSchema,
  CampaignBrainRun: CampaignBrainRunSchema,
  CampaignMonitorRun: CampaignMonitorRunSchema,
  Job: JobSchema,
  AppSettings: AppSettingsSchema,
};

export function parseDomain(name: keyof typeof DomainSchemas, value: unknown) {
  const schema = DomainSchemas[name];
  if (!schema) throw new Error(`Unknown domain schema: ${name}`);
  return schema.parse(value);
}

export function safeParseDomain(name: keyof typeof DomainSchemas, value: unknown) {
  const schema = DomainSchemas[name];
  if (!schema) return { success: false as const, error: `Unknown domain schema: ${name}` };
  return schema.safeParse(value);
}
