import { hasCapability, requestProviderPublish } from "./connectors/registry.js";
import { saveContent, saveQueueJob, saveActivity } from "./collectionRepository.js";
import { recordEvent } from "./events.js";

export function scheduleContent(content, scheduledAt) {
  const next = saveContent({ ...content, status: "SCHEDULED", scheduledAt });
  (content.accountIds || []).forEach((accountId) => {
    saveQueueJob({
      contentId: next.id,
      accountId,
      campaignId: content.campaignId,
      scheduledAt,
      state: "queued",
      manualFallback: true,
    });
  });
  recordEvent("CONTENT_SCHEDULED", {
    campaignId: content.campaignId,
    contentId: next.id,
    message: `Scheduled “${next.title || "untitled"}”`,
  });
  if (content.campaignId) {
    saveActivity({
      campaignId: content.campaignId,
      type: "schedule",
      message: `Scheduled “${next.title || "untitled"}”`,
      source: "MANUAL",
    });
  }
  return next;
}

export function requestPublish(content, account) {
  if (!account) return { ok: false, error: "Select an account." };
  if (account.publishPermission === "ANALYZE_ONLY") {
    return { ok: false, error: "This account is analyze only." };
  }
  if (account.publishPermission === "DRAFT_ONLY") {
    return { ok: false, error: "This account can only hold drafts." };
  }
  if (!hasCapability(account, "PUBLISH_POST")) {
    return {
      ok: false,
      manual: true,
      error: "Unavailable through current connection. Publish on the platform, then mark it published here.",
    };
  }
  if (account.publishPermission === "APPROVAL_REQUIRED") {
    const next = saveContent({ ...content, status: "READY" });
    recordEvent("CONTENT_CHANGED", {
      campaignId: content.campaignId,
      contentId: next.id,
      accountId: account.id,
      message: `Ready for approval: “${next.title || "untitled"}”`,
    });
    return { ok: true, pendingApproval: true, content: next };
  }
  // AUTO_PUBLISH with live connection — enqueue durable provider job (never fake success).
  if (account.connectionState === "CONNECTED" && account.publishPermission === "AUTO_PUBLISH") {
    return {
      ok: true,
      queued: true,
      asyncPublish: () => requestProviderPublish({
        contentId: content.id,
        accountId: account.id,
        approved: true,
      }),
      message: "Publishing through provider pipeline…",
    };
  }
  return {
    ok: false,
    manual: true,
    error: "Unavailable through current connection. Publish on the platform, then mark it published here.",
  };
}

export function markPublished(content, publishedAt = new Date().toISOString()) {
  const next = saveContent({ ...content, status: "PUBLISHED", publishedAt });
  recordEvent("CONTENT_PUBLISHED", {
    campaignId: content.campaignId,
    contentId: next.id,
    message: `Published “${next.title || "untitled"}”`,
  });
  if (content.campaignId) {
    saveActivity({
      campaignId: content.campaignId,
      type: "publish",
      message: `Marked “${next.title || "untitled"}” published`,
      source: "MANUAL",
    });
  }
  return next;
}

export function markFailed(content, reason) {
  const next = saveContent({ ...content, status: "FAILED", notes: [content.notes, reason].filter(Boolean).join("\n") });
  recordEvent("PUBLISH_FAILED", {
    campaignId: content.campaignId,
    contentId: next.id,
    message: reason || `Publish failed for “${next.title || "untitled"}”`,
  });
  return next;
}
