import { z } from "zod";

/**
 * Sprint 98 — typed Campaign Brain / attention contracts (Zod).
 * Runtime validators in validator.js remain the live gate; these schemas
 * document and type-check the intelligence surface for gradual TS adoption.
 */

export const EvidenceReferenceSchema = z.object({
  id: z.string().optional(),
  kind: z.string().optional(),
  label: z.string().optional(),
  ref: z.string().optional(),
}).or(z.string());

export const RecommendationSchema = z.object({
  label: z.string(),
  reason: z.string().optional(),
  href: z.string().optional(),
  priority: z.union([z.string(), z.number()]).optional(),
}).or(z.string());

export const CampaignFindingSchema = z.object({
  message: z.string(),
  severity: z.enum(["INFO", "WARNING", "ERROR", "OPPORTUNITY"]).optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema).optional(),
}).or(z.string());

export const NextBestActionSchema = z.object({
  label: z.string(),
  href: z.string().optional(),
  expectedOutcome: z.string().optional(),
  reason: z.string().optional(),
}).or(z.string()).nullable();

/** Lightweight UI attention row (mirrors AttentionItem props). */
export const AttentionItemSchema = z.object({
  level: z.enum(["ERROR", "WARNING", "ACTION", "INFO"]).default("INFO"),
  message: z.string(),
  href: z.string().optional(),
  meta: z.string().optional(),
  actionLabel: z.string().optional(),
});

export const CampaignBrainInputSchema = z.object({
  mode: z.enum(["ADVISORY", "ASSISTED", "AUTOPILOT"]).or(z.string()).optional(),
  strategy: z.unknown().optional(),
  clarificationQuestions: z.array(z.string()).optional(),
  snapshot: z.unknown().optional(),
  previousSnapshot: z.unknown().nullable().optional(),
  changes: z.array(z.unknown()).optional(),
  accounts: z.array(z.record(z.string(), z.unknown())).optional(),
  accountIntelligence: z.array(z.unknown()).optional(),
  crossCampaignLearning: z.unknown().optional(),
  recentContent: z.array(z.unknown()).optional(),
  analytics: z.array(z.unknown()).optional(),
  priorDecisions: z.array(z.unknown()).optional(),
  rejectedAdvice: z.array(z.unknown()).optional(),
  userOverrides: z.array(z.unknown()).optional(),
});

export const CampaignBrainOutputSchema = z.object({
  campaignSummary: z.string(),
  importantChanges: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).default([]),
  findings: z.array(CampaignFindingSchema).default([]),
  nextBestAction: NextBestActionSchema,
  recommendations: z.array(RecommendationSchema).default([]),
  contentChanges: z.array(z.unknown()).default([]),
  schedulingChanges: z.array(z.unknown()).default([]),
  experimentActions: z.array(z.unknown()).default([]),
  approvalRequests: z.array(z.union([z.string(), z.record(z.string(), z.unknown())])).default([]),
  warnings: z.array(z.union([z.string(), CampaignFindingSchema])).default([]),
  confidence: z.number().nullable().optional(),
  evidenceRefs: z.array(EvidenceReferenceSchema).default([]),
});

export type EvidenceReference = z.infer<typeof EvidenceReferenceSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type CampaignFinding = z.infer<typeof CampaignFindingSchema>;
export type NextBestAction = z.infer<typeof NextBestActionSchema>;
export type AttentionItem = z.infer<typeof AttentionItemSchema>;
export type CampaignBrainInput = z.infer<typeof CampaignBrainInputSchema>;
export type CampaignBrainOutput = z.infer<typeof CampaignBrainOutputSchema>;
