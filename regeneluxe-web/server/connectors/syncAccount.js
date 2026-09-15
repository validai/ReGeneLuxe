import { createId, nowIso } from "../../src/data/ids.js";
import { getConnector, normalizeProviderId } from "../connectors/registry.js";
import { buildMetricSnapshotRecord } from "../connectors/normalizeMetrics.js";
import { upsert, COLLECTIONS } from "../db/index.js";
import { sanitizeAiContext } from "../../src/data/ai/validator.js";

/**
 * Ingest profile + recent analytics/content/interactions for a connected account.
 * Never overwrites historical MetricSnapshots — always inserts new rows.
 */
export async function syncConnectedAccount(account) {
  if (!account?.id) return { ok: false, error: "Account required." };
  if (account.connectionState !== "CONNECTED") {
    return { ok: false, error: `Account state is ${account.connectionState || "UNCONNECTED"}.` };
  }

  const connector = getConnector(account.platform);
  const provider = normalizeProviderId(account.platform);
  const updates = { ...account, updatedAt: nowIso() };
  const ingested = { profile: false, metrics: false, content: 0, interactions: 0, errors: [] };

  try {
    const profile = await connector.getProfile(account);
    if (profile.ok && profile.profile) {
      Object.assign(updates, {
        displayName: profile.profile.displayName || updates.displayName,
        handle: profile.profile.handle || updates.handle,
        profileUrl: profile.profile.profileUrl || updates.profileUrl,
        providerAccountId: profile.profile.providerAccountId || updates.providerAccountId,
        followerCount: profile.profile.followerCount ?? updates.followerCount,
        lastSuccessfulSync: nowIso(),
        lastSync: nowIso(),
        lastErrorSummary: "",
      });
      ingested.profile = true;
    } else if (profile.connectionState) {
      updates.connectionState = profile.connectionState;
      updates.lastErrorSummary = profile.error || profile.reason || "";
      ingested.errors.push(updates.lastErrorSummary);
    }
  } catch (error) {
    ingested.errors.push(error.message || String(error));
  }

  try {
    const metrics = await connector.getAccountMetrics(account);
    if (metrics.ok) {
      const snap = buildMetricSnapshotRecord({
        accountId: account.id,
        platform: account.platform,
        provider,
        source: "PROVIDER",
        metrics: metrics.metrics || {},
        capturedAt: metrics.capturedAt || nowIso(),
        providerUpdatedAt: metrics.providerUpdatedAt || null,
        raw: metrics.raw,
      });
      await upsert(COLLECTIONS.analytics, {
        id: createId("snap"),
        ...snap,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        schemaVersion: 1,
      });
      updates.analyticsFreshness = snap.capturedAt;
      updates.lastSuccessfulSync = nowIso();
      ingested.metrics = true;
    } else if (metrics.error || metrics.reason) {
      ingested.errors.push(metrics.error || metrics.reason);
    }
  } catch (error) {
    ingested.errors.push(error.message || String(error));
  }

  try {
    const content = await connector.getContent?.(account);
    if (content?.ok && Array.isArray(content.items)) {
      for (const item of content.items.slice(0, 25)) {
        if (item.metrics) {
          const snap = buildMetricSnapshotRecord({
            accountId: account.id,
            platform: account.platform,
            provider,
            source: "PROVIDER",
            metrics: item.metrics,
            capturedAt: nowIso(),
            raw: sanitizeAiContext(item.raw || {}),
          });
          await upsert(COLLECTIONS.analytics, {
            id: createId("snap"),
            contentId: item.providerContentId || null,
            ...snap,
            createdAt: nowIso(),
            updatedAt: nowIso(),
            schemaVersion: 1,
          });
        }
        ingested.content += 1;
      }
    }
  } catch (error) {
    ingested.errors.push(error.message || String(error));
  }

  try {
    const comments = await connector.getComments?.(account);
    if (comments?.ok && Array.isArray(comments.items)) {
      for (const item of comments.items.slice(0, 50)) {
        await upsert(COLLECTIONS.inbox, {
          id: createId("inbox"),
          provider,
          accountId: account.id,
          sender: item.sender || "",
          type: item.type || "comment",
          message: item.message || "",
          timestamp: item.timestamp || nowIso(),
          read: false,
          handled: false,
          source: "PROVIDER",
          createdAt: nowIso(),
          updatedAt: nowIso(),
          schemaVersion: 1,
        });
        ingested.interactions += 1;
      }
    }
  } catch (error) {
    ingested.errors.push(error.message || String(error));
  }

  await upsert(COLLECTIONS.accounts, updates);
  return { ok: ingested.errors.length === 0, account: updates, ingested };
}
