/**
 * Publish path helpers with idempotency keys for durable jobs.
 * Prevents duplicate external publishes across crash/restart.
 */
import { createId } from "./ids.js";

export function publicationIdempotencyKey({ contentId, accountId, scheduledAt }) {
  return `publish:${contentId}:${accountId || "none"}:${scheduledAt || "now"}`;
}

export function buildPublishJobPayload(content, account, scheduledAt = null) {
  return {
    contentId: content.id,
    accountId: account?.id || null,
    campaignId: content.campaignId || null,
    platform: account?.platform || null,
    scheduledAt,
    idempotencyKey: publicationIdempotencyKey({
      contentId: content.id,
      accountId: account?.id,
      scheduledAt,
    }),
  };
}

export function newAttemptId() {
  return createId("pub");
}
