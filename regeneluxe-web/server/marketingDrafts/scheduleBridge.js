/**
 * Bridge: approved + scheduled marketing drafts → PUBLISH_CONTENT jobs.
 * Reuses hardened publish worker. Does not invent a second publisher.
 */

import { initDb, list, COLLECTIONS, get } from "../db/index.js";
import { enqueuePublish } from "../jobs/worker.js";
import { publicationIdempotencyKey } from "../../src/data/idempotency.js";
import { draftApprovalFingerprint } from "./model.js";
import { isMarketingDraft } from "./service.js";

export function marketingPublishIdempotencyKey(draft) {
  return publicationIdempotencyKey({
    contentId: draft.id,
    accountId: draft.destinationAccountId,
    scheduledAt: draft.scheduledFor,
  });
}

/**
 * Ensure a durable scheduled PUBLISH_CONTENT job exists for an approved draft.
 * Safe to call repeatedly (idempotent key).
 */
export async function ensureMarketingPublishJob(draftId) {
  await initDb();
  const draft = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(draft)) {
    return { ok: false, error: "Not a marketing draft." };
  }
  if (draft.approvalStatus !== "APPROVED" || draft.status !== "APPROVED") {
    return { ok: false, error: "Draft is not creatively approved." };
  }
  if (!draft.scheduledFor) {
    return { ok: false, error: "Draft has no authoritative schedule." };
  }
  if (!draft.destinationAccountId) {
    return { ok: false, error: "Draft has no destination account." };
  }

  const account = await get(COLLECTIONS.accounts, draft.destinationAccountId);
  if (!account) {
    return { ok: false, error: "Destination account not found." };
  }

  const key = marketingPublishIdempotencyKey(draft);
  const job = await enqueuePublish({
    contentId: draft.id,
    accountId: account.id,
    scheduledAt: draft.scheduledFor,
    managedProfileId: draft.workspaceId || draft.managedProfileId || "",
    workspaceId: draft.workspaceId || draft.managedProfileId || "",
    campaignId: draft.campaignId || "",
    marketingAuthority: true,
    marketingApprovalId: draft.approvalId || "",
    marketingFingerprint: draftApprovalFingerprint(draft),
    dryRun: false,
    idempotencyKey: key,
  });

  const next = {
    ...draft,
    status: draft.status === "APPROVED" ? "SCHEDULED" : draft.status,
    dispatchState: "SCHEDULED",
    publishJobId: job.id,
    publishIdempotencyKey: key,
    updatedAt: new Date().toISOString(),
  };
  const { upsert } = await import("../db/index.js");
  await upsert(COLLECTIONS.content, next);

  return { ok: true, job, draft: next };
}

/**
 * Scan approved+scheduled drafts missing jobs (recovery / bootstrap).
 */
export async function reconcileMarketingPublishJobs({ limit = 50 } = {}) {
  await initDb();
  const rows = await list(COLLECTIONS.content);
  const drafts = rows.filter((row) => (
    isMarketingDraft(row)
    && row.approvalStatus === "APPROVED"
    && row.scheduledFor
    && row.destinationAccountId
    && !["PUBLISHED", "SKIPPED", "EXPIRED", "FAILED"].includes(row.status)
  ));
  const results = [];
  for (const draft of drafts.slice(0, limit)) {
    results.push(await ensureMarketingPublishJob(draft.id));
  }
  return { ok: true, scanned: drafts.length, results };
}
