import { getContent, saveContent, saveQueueJob, saveActivity, listQueue } from "./collectionRepository.js";
import { getAccount } from "./accountRepository.js";
import { hasCapability } from "./connectors/registry.js";
import { markPublished, markFailed } from "./publishing.js";

export function listQueueJobs(filters = {}) {
  return listQueue().filter((job) => {
    if (filters.state && job.state !== filters.state) return false;
    if (filters.campaignId && job.campaignId !== filters.campaignId) return false;
    if (filters.accountId && job.accountId !== filters.accountId) return false;
    return true;
  }).sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
}

/**
 * Process a queue job. Never pretends provider publish succeeded.
 * Manual fallback remains the honest path until a real connector exists.
 */
export function processQueueJob(jobId, { forceManual = false } = {}) {
  const job = listQueue().find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Queue job not found." };

  const content = getContent(job.contentId);
  const account = getAccount(job.accountId);

  if (!content) {
    const failed = saveQueueJob({ ...job, state: "failed", failureReason: "Content missing." });
    return { ok: false, error: "Content missing.", job: failed };
  }

  if (!account) {
    const failed = saveQueueJob({ ...job, state: "failed", failureReason: "Account missing." });
    return { ok: false, error: "Account missing.", job: failed };
  }

  if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
    const failed = saveQueueJob({
      ...job,
      state: "failed",
      failureReason: `Account permission is ${account.publishPermission}.`,
    });
    return { ok: false, error: failed.failureReason, job: failed };
  }

  if (account.publishPermission === "APPROVAL_REQUIRED" && content.status !== "READY" && content.status !== "SCHEDULED") {
    const next = saveContent({ ...content, status: "READY" });
    const waiting = saveQueueJob({
      ...job,
      state: "awaiting_approval",
      manualFallback: true,
      providerResult: "Approval required before publish.",
    });
    return { ok: true, pendingApproval: true, content: next, job: waiting };
  }

  if (!forceManual && hasCapability(account, "PUBLISH_POST")) {
    // Capability declared for CONNECTED accounts, but no live adapter executes yet.
    const waiting = saveQueueJob({
      ...job,
      state: "manual_required",
      manualFallback: true,
      providerResult: "Provider publish is not wired for this connection yet.",
      failureReason: "",
    });
    return {
      ok: false,
      manual: true,
      error: "Unavailable through current connection. Publish on the platform, then confirm here.",
      job: waiting,
    };
  }

  const waiting = saveQueueJob({
    ...job,
    state: "manual_required",
    manualFallback: true,
    providerResult: "Manual publish required.",
  });
  return {
    ok: false,
    manual: true,
    error: "Unavailable through current connection. Publish on the platform, then confirm here.",
    job: waiting,
  };
}

export function confirmManualPublish(jobId, publishedAt = new Date().toISOString()) {
  const job = listQueue().find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Queue job not found." };
  const content = getContent(job.contentId);
  if (!content) return { ok: false, error: "Content missing." };

  const published = markPublished(content, publishedAt);
  const done = saveQueueJob({
    ...job,
    state: "completed_manual",
    providerResult: "Marked published manually.",
    failureReason: "",
  });
  if (job.campaignId) {
    saveActivity({
      campaignId: job.campaignId,
      type: "queue",
      message: `Queue job confirmed published for “${published.title || "untitled"}”.`,
      source: "MANUAL",
    });
  }
  return { ok: true, content: published, job: done };
}

export function retryQueueJob(jobId) {
  const job = listQueue().find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Queue job not found." };
  const next = saveQueueJob({
    ...job,
    state: "queued",
    retryCount: (job.retryCount || 0) + 1,
    failureReason: "",
  });
  return processQueueJob(next.id);
}

export function failQueueJob(jobId, reason) {
  const job = listQueue().find((item) => item.id === jobId);
  if (!job) return { ok: false, error: "Queue job not found." };
  const content = getContent(job.contentId);
  if (content) markFailed(content, reason);
  const failed = saveQueueJob({
    ...job,
    state: "failed",
    failureReason: reason || "Marked failed.",
  });
  return { ok: true, job: failed };
}
