import { createId, nowIso } from "../../src/data/ids.js";
import {
  claimNextJob,
  completeJob,
  failJob,
  enqueueJob,
  JOB_TYPES,
  list,
  upsert,
  COLLECTIONS,
} from "../db/index.js";
import { getConnector, normalizeProviderId } from "../connectors/registry.js";
import { buildMetricSnapshotRecord } from "../connectors/normalizeMetrics.js";
import { pushOutboxToRemote, reconcileWithRemote } from "../db/sync.js";
import { publicationIdempotencyKey } from "../../src/data/idempotency.js";

const WORKER_ID = `worker_${process.pid}`;

async function loadAccount(accountId) {
  if (!accountId) return null;
  return list(COLLECTIONS.accounts).then((rows) => rows.find((a) => a.id === accountId) || null)
    .catch(async () => {
      const rows = await list(COLLECTIONS.accounts);
      return rows.find((a) => a.id === accountId) || null;
    });
}

async function handleSyncRemote(payload = {}) {
  if (payload.pull === false) return pushOutboxToRemote();
  return reconcileWithRemote();
}

async function handleRefreshAnalytics(payload = {}) {
  const accountId = payload.accountId;
  const account = await loadAccount(accountId);
  if (!account) throw new Error("Account not found for analytics refresh.");
  if (account.connectionState !== "CONNECTED") {
    throw new Error(`Account is ${account.connectionState || "not connected"} — cannot refresh provider analytics.`);
  }
  const connector = getConnector(account.platform);
  const metricsResult = await connector.getAccountMetrics(account);
  if (!metricsResult.ok) {
    const err = new Error(metricsResult.error || metricsResult.reason || "Analytics refresh failed");
    err.code = metricsResult.error === "rate_limited" ? "RATE_LIMITED" : "PROVIDER_ERROR";
    throw err;
  }

  const snap = buildMetricSnapshotRecord({
    accountId: account.id,
    campaignId: payload.campaignId || null,
    platform: account.platform,
    provider: normalizeProviderId(account.platform),
    source: "PROVIDER",
    metrics: metricsResult.metrics || {},
    capturedAt: metricsResult.capturedAt || nowIso(),
    providerUpdatedAt: metricsResult.providerUpdatedAt || null,
    raw: metricsResult.raw,
  });

  const record = {
    id: createId("snap"),
    ...snap,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    schemaVersion: 1,
  };
  await upsert(COLLECTIONS.analytics, record);

  await upsert(COLLECTIONS.accounts, {
    ...account,
    lastSync: nowIso(),
    lastSuccessfulSync: nowIso(),
    analyticsFreshness: record.capturedAt,
    lastErrorSummary: "",
    updatedAt: nowIso(),
  });

  // Optional content metrics
  if (payload.includeContent) {
    const content = await connector.getContent(account);
    if (content.ok && Array.isArray(content.items)) {
      for (const item of content.items.slice(0, 25)) {
        if (!item.metrics) continue;
        const contentSnap = buildMetricSnapshotRecord({
          accountId: account.id,
          platform: account.platform,
          provider: normalizeProviderId(account.platform),
          source: "PROVIDER",
          metrics: item.metrics,
          capturedAt: nowIso(),
          raw: item.raw || null,
        });
        await upsert(COLLECTIONS.analytics, {
          id: createId("snap"),
          ...contentSnap,
          contentId: item.providerContentId || null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
          schemaVersion: 1,
        });
      }
    }
  }

  return { ok: true, snapshotId: record.id };
}

async function handleRefreshConnection(payload = {}) {
  const account = await loadAccount(payload.accountId);
  if (!account) throw new Error("Account not found.");
  const connector = getConnector(account.platform);
  const profile = await connector.getProfile(account);
  if (!profile.ok) {
    await upsert(COLLECTIONS.accounts, {
      ...account,
      connectionState: profile.connectionState || "RECONNECT_REQUIRED",
      lastErrorSummary: profile.error || profile.reason || "Refresh failed",
      updatedAt: nowIso(),
    });
    throw new Error(profile.error || profile.reason || "Connection refresh failed");
  }
  await upsert(COLLECTIONS.accounts, {
    ...account,
    ...profile.profile,
    connectionState: "CONNECTED",
    connectionMethod: "OAUTH",
    lastSync: nowIso(),
    lastSuccessfulSync: nowIso(),
    lastErrorSummary: "",
    updatedAt: nowIso(),
  });
  return { ok: true, profile: profile.profile };
}

async function handlePublishContent(payload = {}) {
  const account = await loadAccount(payload.accountId);
  if (!account) throw new Error("Account not found.");
  if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
    throw new Error(`Publishing blocked by permission ${account.publishPermission}.`);
  }
  if (account.publishPermission === "APPROVAL_REQUIRED" && !payload.approved) {
    throw new Error("Approval required before publish.");
  }

  const contentRows = await list(COLLECTIONS.content);
  const content = contentRows.find((c) => c.id === payload.contentId);
  if (!content) throw new Error("Content not found.");

  const idempotencyKey = payload.idempotencyKey
    || publicationIdempotencyKey({
      contentId: content.id,
      accountId: account.id,
      scheduledAt: payload.scheduledAt || content.scheduledAt,
    });

  // Idempotency: if a successful attempt already exists, do not publish again.
  const attempts = await list(COLLECTIONS.publication_attempts).catch(() => []);
  const priorSuccess = attempts.find((a) => (
    a.idempotencyKey === idempotencyKey
    && ["PUBLISHED", "CONFIRMED"].includes(a.state)
  ));
  if (priorSuccess) {
    return { ok: true, deduped: true, attempt: priorSuccess };
  }

  const attempt = {
    id: createId("pub"),
    contentId: content.id,
    accountId: account.id,
    platform: account.platform,
    campaignId: content.campaignId || null,
    idempotencyKey,
    state: "ATTEMPTED",
    providerResult: null,
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    schemaVersion: 1,
  };
  await upsert(COLLECTIONS.publication_attempts, attempt);

  const connector = getConnector(account.platform);
  const result = await connector.publishContent(account, {
    text: content.caption || content.title,
    caption: content.caption,
    mediaUrl: content.mediaRefs?.[0]?.url || content.mediaUrl,
    imageUrl: content.imageUrl,
    videoPath: content.videoPath,
  });

  if (!result.ok) {
    const failed = {
      ...attempt,
      state: "FAILED",
      error: result.error || result.reason || "Publish failed",
      providerResult: result.raw || result,
      updatedAt: nowIso(),
    };
    await upsert(COLLECTIONS.publication_attempts, failed);
    await upsert(COLLECTIONS.content, {
      ...content,
      status: "FAILED",
      updatedAt: nowIso(),
    });
    throw new Error(failed.error);
  }

  const published = {
    ...attempt,
    state: "PUBLISHED",
    providerResult: {
      providerPostId: result.providerPostId,
      raw: result.raw || null,
    },
    error: null,
    updatedAt: nowIso(),
  };
  await upsert(COLLECTIONS.publication_attempts, published);
  await upsert(COLLECTIONS.content, {
    ...content,
    status: "PUBLISHED",
    publishedAt: nowIso(),
    providerPostIds: {
      ...(content.providerPostIds || {}),
      [account.id]: result.providerPostId,
    },
    updatedAt: nowIso(),
  });
  return { ok: true, attempt: published, providerPostId: result.providerPostId };
}

async function handleCampaignMonitor(payload = {}) {
  // Marker job — client/monitor still owns calculated logic; durable stamp only.
  return {
    ok: true,
    note: "Campaign monitor job acknowledged. Run observeCampaign on the client with durable snapshots.",
    campaignId: payload.campaignId || null,
  };
}

async function handleCampaignBrain(payload = {}) {
  return {
    ok: true,
    note: "Campaign brain job acknowledged. Structured AI validation remains server /api/ai/complete.",
    campaignId: payload.campaignId || null,
  };
}

async function dispatch(job) {
  switch (job.type) {
    case JOB_TYPES.SYNC_REMOTE:
      return handleSyncRemote(job.payload);
    case JOB_TYPES.REFRESH_ANALYTICS:
      return handleRefreshAnalytics(job.payload);
    case JOB_TYPES.REFRESH_CONNECTION:
      return handleRefreshConnection(job.payload);
    case JOB_TYPES.PUBLISH_CONTENT:
      return handlePublishContent(job.payload);
    case JOB_TYPES.RUN_CAMPAIGN_MONITOR:
      return handleCampaignMonitor(job.payload);
    case JOB_TYPES.RUN_CAMPAIGN_BRAIN:
      return handleCampaignBrain(job.payload);
    case JOB_TYPES.EVALUATE_EXPERIMENT:
      return { ok: true, note: "Experiment evaluation deferred to Campaign Brain outcome learning." };
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

/**
 * Claim and process up to `limit` jobs. Safe to call from /api/jobs/tick.
 * @param {{ limit?: number, types?: string[] | null }} [options]
 */
export async function processJobQueue(options = {}) {
  const limit = options.limit ?? 5;
  const types = options.types ?? null;
  const results = [];
  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(WORKER_ID, types);
    if (!job) break;
    try {
      const result = await dispatch(job);
      await completeJob(job.id);
      results.push({ id: job.id, type: job.type, ok: true, result });
    } catch (error) {
      await failJob(job.id, error, {
        maxAttempts: error?.code === "RATE_LIMITED" ? 12 : 8,
      });
      results.push({
        id: job.id,
        type: job.type,
        ok: false,
        error: error?.message || String(error),
      });
    }
  }
  return { processed: results.length, results };
}

export async function enqueueAnalyticsRefresh(accountId, extra = {}) {
  return enqueueJob({
    type: JOB_TYPES.REFRESH_ANALYTICS,
    payload: { accountId, ...extra },
    idempotencyKey: `refresh_analytics:${accountId}:${extra.contentId || "account"}:${new Date().toISOString().slice(0, 13)}`,
  });
}

export async function enqueuePublish(payload) {
  const key = payload.idempotencyKey
    || publicationIdempotencyKey(payload);
  return enqueueJob({
    type: JOB_TYPES.PUBLISH_CONTENT,
    payload: { ...payload, idempotencyKey: key },
    idempotencyKey: key,
    scheduledAt: payload.scheduledAt || null,
  });
}
