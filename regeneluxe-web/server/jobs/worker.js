import { createId, nowIso } from "../../src/data/ids.js";
import { SOCIAL_CONNECTION_STATES } from "../../src/data/statusContracts.js";
import {
  claimNextJob,
  completeJob,
  failJob,
  enqueueJob,
  releaseJob,
  deferJob,
  JOB_TYPES,
  list,
  upsert,
  get,
  COLLECTIONS,
} from "../db/index.js";
import { getLocalClient } from "../db/client.js";
import { getConnector, normalizeProviderId } from "../connectors/registry.js";
import { buildMetricSnapshotRecord } from "../connectors/normalizeMetrics.js";
import { pushOutboxToRemote, reconcileWithRemote } from "../db/sync.js";
import { publicationIdempotencyKey } from "../../src/data/idempotency.js";
import { evaluatePublishGate } from "../../src/data/publishGate.js";
import { isPilotProvider, variantForAccount } from "../../src/data/publishApproval.js";
import { stripSecretFields } from "../../src/data/secretFields.js";
import { classifyMediaUrl } from "../../src/data/mediaReadiness.js";
import { preparePublicationMedia, markPublicationDeliveryEligible } from "../media/publicationDelivery.js";
import { recordBelongsToWorkspace, workspaceIdOf } from "../auth/tenantScope.js";

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
  if (account.connectionState !== SOCIAL_CONNECTION_STATES.CONNECTED) {
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
      connectionState: profile.connectionState || SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
      lastErrorSummary: profile.error || profile.reason || "Refresh failed",
      updatedAt: nowIso(),
    });
    throw new Error(profile.error || profile.reason || "Connection refresh failed");
  }
  await upsert(COLLECTIONS.accounts, {
    ...account,
    ...profile.profile,
    connectionState: SOCIAL_CONNECTION_STATES.CONNECTED,
    connectionMethod: "OAUTH",
    lastSync: nowIso(),
    lastSuccessfulSync: nowIso(),
    lastErrorSummary: "",
    updatedAt: nowIso(),
  });
  return { ok: true, profile: profile.profile };
}

async function consumeApproval(id) {
  const now = nowIso();
  const result = await getLocalClient().execute({
    sql: `UPDATE entities
          SET payload = json_set(payload, '$.consumedAt', ?),
              updated_at = ?,
              revision = revision + 1
          WHERE collection = ?
            AND id = ?
            AND (json_extract(payload, '$.consumedAt') IS NULL OR json_extract(payload, '$.consumedAt') = '')`,
    args: [now, now, COLLECTIONS.approvals, id],
  });
  return Number(result.rowsAffected || 0) === 1;
}

async function markDraftSkipped(content, reason) {
  await upsert(COLLECTIONS.content, {
    ...content,
    status: "SKIPPED",
    dispatchState: "SKIPPED",
    skipReason: reason,
    updatedAt: nowIso(),
  });
}

async function handlePublishContent(payload = {}) {
  const account = await loadAccount(payload.accountId);
  if (!account) throw new Error("Account not found.");
  const provider = normalizeProviderId(account.platform);
  const contentRows = await list(COLLECTIONS.content);
  const content = contentRows.find((row) => row.id === payload.contentId);
  if (!content) throw new Error("Content not found.");

  const { getManagedProfile } = await import("../db/managedProfileRepository.js");
  const { assertProviderWriteAllowed } = await import("../certification/productionWriteGuard.js");
  const workspaceId = payload.managedProfileId || account.managedProfileId || content.managedProfileId || "";
  const workspace = workspaceId ? await getManagedProfile(workspaceId) : null;
  const writeGate = assertProviderWriteAllowed({
    workspace,
    account,
    dryRun: Boolean(payload.dryRun),
  });
  if (!writeGate.ok) {
    const err = new Error(writeGate.code || "PROVIDER_WRITE_BLOCKED");
    err.code = writeGate.code || "PROVIDER_WRITE_BLOCKED";
    err.detail = writeGate.error;
    throw err;
  }

  const idempotencyKey = payload.idempotencyKey
    || publicationIdempotencyKey({
      contentId: content.id,
      accountId: account.id,
      scheduledAt: payload.scheduledAt || content.scheduledAt || content.scheduledFor,
    });

  const attempts = await list(COLLECTIONS.publication_attempts).catch(() => []);
  const sameAttempt = attempts.filter((attempt) => attempt.idempotencyKey === idempotencyKey);
  const priorSuccess = sameAttempt.find((attempt) => ["PUBLISHED", "CONFIRMED"].includes(attempt.state));
  if (priorSuccess) {
    return { ok: true, deduped: true, code: "DUPLICATE_SUPPRESSED", attempt: priorSuccess };
  }
  const ambiguous = sameAttempt.find((attempt) => {
    if (attempt.state === "ATTEMPTED") return true;
    const result = attempt.providerResult || {};
    return Boolean(attempt.providerPostId || result.providerPostId || result.containerId);
  });
  if (ambiguous) {
    return { ok: true, deduped: true, code: "DUPLICATE_SUPPRESSED", attempt: ambiguous };
  }

  // Marketing scheduled authority: shared eligibility, durable approval, no 15-minute session.
  if (payload.marketingAuthority) {
    const { prepareScheduledDispatch, DISPATCH_SKIP_REASONS } = await import("../marketingDrafts/dispatchPipeline.js");
    const prepared = await prepareScheduledDispatch(content, account, {
      dryRun: Boolean(payload.dryRun),
      priorAttemptExists: false,
      expectedFingerprint: payload.marketingFingerprint || null,
    });
    if (prepared.blocker === DISPATCH_SKIP_REASONS.PAUSED) {
      const err = new Error("PAUSED");
      err.code = "PAUSED";
      throw err;
    }
    if (!prepared.ok) {
      const reason = prepared.blocker || "NOT_ELIGIBLE";
      await upsert(COLLECTIONS.publication_attempts, blockedAttempt({
        content,
        account,
        provider,
        idempotencyKey,
        approvalId: payload.marketingApprovalId || "",
        error: reason,
      }));
      await markDraftSkipped(content, reason);
      return {
        ok: true,
        skipped: true,
        code: reason,
        dryRun: false,
        providerWrite: false,
        reasons: prepared.reasons,
      };
    }
    if (payload.dryRun) {
      return {
        ok: true,
        DRY_RUN: true,
        providerWrite: false,
        simulatedProviderResult: prepared.simulatedProviderResult,
      };
    }
  }

  const connectorForGate = getConnector(account.platform);
  const publishCapabilities = connectorForGate.capabilities || [];
  const canPublish = publishCapabilities.some((capability) => (
    capability === "PUBLISH_TEXT"
    || capability === "PUBLISH_IMAGE"
    || capability === "PUBLISH_VIDEO"
    || capability === "PUBLISH_SHORT_VIDEO"
    || capability === "PUBLISH_LONG_VIDEO"
  ));
  if (!canPublish) {
    await upsert(COLLECTIONS.publication_attempts, blockedAttempt({
      content, account, provider, idempotencyKey, approvalId: payload.approvalId || "", error: "PUBLISH_NOT_SUPPORTED",
    }));
    const error = new Error("PUBLISH_NOT_SUPPORTED");
    error.code = "PUBLISH_NOT_SUPPORTED";
    throw error;
  }

  const variant = variantForAccount(content, account);
  let approval = null;
  if (payload.marketingAuthority) {
    // Durable marketing approval already rechecked above.
    approval = payload.marketingApprovalId
      ? await get(COLLECTIONS.approvals, payload.marketingApprovalId)
      : null;
  } else if (isPilotProvider(provider)) {
    approval = payload.approvalId ? await get(COLLECTIONS.approvals, payload.approvalId) : null;
    const gate = evaluatePublishGate({
      account,
      content,
      approval,
      workspaceId: payload.managedProfileId || account.managedProfileId || "",
      operatorId: payload.operatorId || approval?.operatorId || "",
      idempotencyKey,
    });
    if (!gate.ok) {
      await upsert(COLLECTIONS.publication_attempts, blockedAttempt({
        content, account, provider, idempotencyKey, approvalId: payload.approvalId || "", error: gate.error,
      }));
      throw new Error(gate.error);
    }
  } else {
    if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
      throw new Error(`Publishing blocked by permission ${account.publishPermission}.`);
    }
    if (account.publishPermission === "APPROVAL_REQUIRED" && !payload.approved) {
      throw new Error("Approval required before publish.");
    }
  }

  const wantsVideo = Boolean(
    content.contentType === "REEL"
    || content.contentType === "VIDEO"
    || content.mediaKind === "VIDEO"
    || content.videoPath
    || /\.(mp4|mov|webm)(\?|$)/i.test(String(variant.mediaRef || "")),
  );
  let imageUrl = variant.mediaRef;
  let videoUrl = "";
  let delivery = null;
  if ((provider === "instagram" || provider === "facebook") && variant.mediaId) {
    delivery = await preparePublicationMedia({
      workspaceId: payload.managedProfileId || account.managedProfileId || "",
      accountId: account.id,
      contentId: content.id,
      mediaId: variant.mediaId,
      purpose: wantsVideo ? `${provider}_video` : `${provider}_image`,
      idempotencyKey,
    });
    if (!delivery.ok || classifyMediaUrl(delivery.publicUrl) !== "PUBLIC_PROVIDER_MEDIA") {
      await upsert(COLLECTIONS.publication_attempts, blockedAttempt({
        content, account, provider, idempotencyKey, approvalId: approval?.id || "", error: "MEDIA_NOT_PUBLIC",
      }));
      throw new Error("MEDIA_NOT_PUBLIC");
    }
    if (wantsVideo) videoUrl = delivery.publicUrl;
    else imageUrl = delivery.publicUrl;
  } else if (provider === "instagram" && wantsVideo && classifyMediaUrl(variant.mediaRef) === "PUBLIC_PROVIDER_MEDIA") {
    videoUrl = variant.mediaRef;
  }

  if (approval && !payload.marketingAuthority) {
    const consumed = await consumeApproval(approval.id);
    if (!consumed) throw new Error("APPROVAL_CONSUMED");
  }

  const attempt = {
    ...blockedAttempt({
      content, account, provider, idempotencyKey, approvalId: approval?.id || payload.marketingApprovalId || "", error: "",
    }),
    state: "ATTEMPTED",
    error: null,
    deliveryId: delivery?.deliveryId || "",
    dryRun: false,
    campaignId: payload.campaignId || content.campaignId || "",
    requestedSchedule: payload.scheduledAt || content.scheduledFor || content.scheduledAt || null,
  };
  await upsert(COLLECTIONS.publication_attempts, attempt);

  const privacyStatus = String(content.privacyStatus || payload.privacyStatus || "private").toLowerCase();
  const connector = getConnector(account.platform);
  const result = await connector.publishContent(account, {
    text: variant.caption || variant.title,
    caption: variant.caption,
    title: variant.title,
    mediaUrl: videoUrl || imageUrl,
    imageUrl: videoUrl ? "" : imageUrl,
    videoUrl,
    videoPath: provider === "youtube"
      ? (content.videoPath || variant.mediaRef)
      : "",
    privacyStatus: ["private", "unlisted", "public"].includes(privacyStatus) ? privacyStatus : "private",
  });
  const safeResult = stripSecretFields(result || {});

  if (!result.ok) {
    const failed = {
      ...attempt,
      state: "FAILED",
      error: result.error || result.reason || "Publish failed",
      errorCategory: result.code || "PROVIDER_ERROR",
      providerStatus: result.providerStatus || "",
      providerResult: safeResult,
      completedAt: nowIso(),
      updatedAt: nowIso(),
    };
    await upsert(COLLECTIONS.publication_attempts, failed);
    if (delivery?.deliveryId) {
      const eligible = await markPublicationDeliveryEligible(delivery.deliveryId, { outcome: "failed" });
      if (eligible?.cleanupEligibleAt) {
        await enqueueJob({
          type: JOB_TYPES.CLEANUP_PUBLIC_MEDIA,
          payload: {
            deliveryId: delivery.deliveryId,
            workspaceId: payload.managedProfileId || account.managedProfileId || "",
          },
          scheduledAt: eligible.cleanupEligibleAt,
          idempotencyKey: `cleanup_public_media:${delivery.deliveryId}:failed`,
        });
      }
    }
    await upsert(COLLECTIONS.content, {
      ...content,
      status: "FAILED",
      updatedAt: nowIso(),
    });
    throw new Error(failed.error);
  }

  const publishedAt = nowIso();
  const published = {
    ...attempt,
    state: "PUBLISHED",
    providerPostId: result.providerPostId || "",
    externalUrl: result.permalink || "",
    providerStatus: result.privacyStatus || result.providerStatus || "PUBLISHED",
    providerResult: safeResult,
    dryRun: false,
    actualPublishedAt: publishedAt,
    error: null,
    completedAt: publishedAt,
    updatedAt: publishedAt,
  };
  await upsert(COLLECTIONS.publication_attempts, published);
  if (delivery?.deliveryId) {
    const eligible = await markPublicationDeliveryEligible(delivery.deliveryId, { outcome: "published" });
    if (eligible?.cleanupEligibleAt) {
      await enqueueJob({
        type: JOB_TYPES.CLEANUP_PUBLIC_MEDIA,
        payload: {
          deliveryId: delivery.deliveryId,
          workspaceId: payload.managedProfileId || account.managedProfileId || "",
        },
        scheduledAt: eligible.cleanupEligibleAt,
        idempotencyKey: `cleanup_public_media:${delivery.deliveryId}`,
      });
    }
  }
  await upsert(COLLECTIONS.content, {
    ...content,
    status: "PUBLISHED",
    dispatchState: "PUBLISHED",
    publishedAt,
    providerPostIds: {
      ...(content.providerPostIds || {}),
      [account.id]: result.providerPostId,
    },
    updatedAt: publishedAt,
  });
  return { ok: true, attempt: published, providerPostId: result.providerPostId, dryRun: false };
}

function blockedAttempt({ content, account, provider, idempotencyKey, approvalId, error }) {
  const stamp = nowIso();
  return {
    id: createId("pub"),
    provider,
    accountId: account.id,
    contentId: content.id,
    campaignId: content.campaignId || null,
    approvalId: approvalId || "",
    idempotencyKey,
    state: "FAILED",
    errorCategory: error || "",
    error: error || null,
    providerPostId: "",
    externalUrl: "",
    providerStatus: "",
    startedAt: stamp,
    completedAt: error ? stamp : null,
    createdAt: stamp,
    updatedAt: stamp,
    schemaVersion: 1,
  };
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

async function handleSyncGmail(payload = {}) {
  const { runGmailSyncJob } = await import("../connectors/gmailSync.js");
  return runGmailSyncJob(payload);
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
    case JOB_TYPES.CLEANUP_PUBLIC_MEDIA: {
      const { cleanupDuePublicationMedia } = await import("../media/publicationDelivery.js");
      return cleanupDuePublicationMedia({ workspaceId: job.payload?.workspaceId || "" });
    }
    case JOB_TYPES.RUN_CAMPAIGN_MONITOR:
      return handleCampaignMonitor(job.payload);
    case JOB_TYPES.RUN_CAMPAIGN_BRAIN:
      return handleCampaignBrain(job.payload);
    case JOB_TYPES.EVALUATE_EXPERIMENT:
      return { ok: true, note: "Experiment evaluation deferred to Campaign Brain outcome learning." };
    case JOB_TYPES.SYNC_GMAIL:
      return handleSyncGmail(job.payload);
    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function jobAllowedForWorkspace(job, authz) {
  if (!authz) return true;
  const workspaceId = workspaceIdOf(authz);
  if (!workspaceId) return false;
  const payload = job.payload || {};
  if (job.type === JOB_TYPES.SYNC_REMOTE) return true;
  if (payload.managedProfileId && payload.managedProfileId !== workspaceId) return false;
  if (payload.workspaceId && payload.workspaceId !== workspaceId) return false;
  if (payload.profileId && payload.profileId !== workspaceId) return false;
  if (payload.accountId) {
    const account = await loadAccount(payload.accountId);
    if (account && !recordBelongsToWorkspace(account, authz)) return false;
  }
  if (payload.contentId) {
    const content = await get(COLLECTIONS.content, payload.contentId);
    if (content && !recordBelongsToWorkspace(content, authz)) return false;
  }
  return true;
}

/**
 * Claim and process up to `limit` jobs. Safe to call from /api/jobs/tick.
 * @param {{
 *   limit?: number,
 *   types?: string[] | null,
 *   authz?: { operator?: object, workspace?: object, activeProfile?: object },
 * }} [options]
 */
export async function processJobQueue(options = {}) {
  const { cleanupOrphanSessionCredentials } = await import("../secrets/sessionCredentialCleanup.js");
  await cleanupOrphanSessionCredentials().catch(() => {});
  const limit = options.limit ?? 5;
  const types = options.types ?? null;
  const results = [];
  const excludeIds = [];
  for (let i = 0; i < limit; i += 1) {
    const job = await claimNextJob(WORKER_ID, types, null, { excludeIds });
    if (!job) break;
    if (!(await jobAllowedForWorkspace(job, options.authz))) {
      excludeIds.push(job.id);
      await releaseJob(job.id);
      continue;
    }
    try {
      const result = await dispatch(job);
      await completeJob(job.id);
      results.push({ id: job.id, type: job.type, ok: true, result });
    } catch (error) {
      if (error?.code === "PAUSED" || error?.code === "DEFER_PUBLISH") {
        await deferJob(job.id, 60_000);
        results.push({
          id: job.id,
          type: job.type,
          ok: true,
          deferred: true,
          code: error.code,
        });
        continue;
      }
      await failJob(job.id, error, {
        maxAttempts: error?.code === "RATE_LIMITED" ? 12 : error?.code === "PUBLISH_NOT_SUPPORTED" ? 1 : 8,
      });
      results.push({
        id: job.id,
        type: job.type,
        ok: false,
        error: error?.message || String(error),
        code: error?.code || "",
        retryable: error?.code === "RATE_LIMITED" || error?.code === "PROVIDER_UNAVAILABLE",
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
