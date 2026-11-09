import { initDb, list, COLLECTIONS, getDbHealth } from "../db/index.js";
import { publicMediaReadiness } from "../media/publicProvider.js";
import { listProviderDefinitions } from "../connectors/registry.js";
import { NORTH_STAR } from "./northStar.js";
import { runtimeIdentity } from "../config.js";

const SECRET_FIELD = /token|secret|password|cipher|authorization|apiKey|verifier|refresh|access_token|pageAccessToken|AUTH_SECRET|BLOB_|pairingCredential|sessionToken|credentialHash|tokenHash/i;

export function scrubValue(value, depth = 0) {
  if (depth > 6) return null;
  if (value == null) return value;
  if (typeof value === "string") {
    if (SECRET_FIELD.test(value) && value.length > 24) return "[redacted]";
    return value.slice(0, 500);
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => scrubValue(item, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      if (SECRET_FIELD.test(key)) {
        out[key] = nested == null || nested === "" ? false : "[redacted]";
        continue;
      }
      out[key] = scrubValue(nested, depth + 1);
    }
    return out;
  }
  return null;
}

function scopeRows(rows, workspaceId) {
  if (!workspaceId) return [];
  return (rows || []).filter((row) => row?.managedProfileId === workspaceId);
}

function summarizeAccounts(accounts) {
  return (accounts || []).map((account) => ({
    id: account.id,
    platform: account.platform || "",
    connectionState: account.connectionState || "",
    displayName: account.displayName || "",
    handle: account.handle || "",
    hasExternalId: Boolean(account.providerAccountId || account.externalDestinationId),
    publishPermission: account.publishPermission || "",
  }));
}

function summarizeCampaigns(campaigns) {
  return (campaigns || []).map((campaign) => ({
    id: campaign.id,
    name: campaign.name || campaign.title || "",
    status: campaign.status || "",
    accountCount: Array.isArray(campaign.accountIds) ? campaign.accountIds.length : null,
  }));
}

function summarizeContent(content) {
  return (content || []).slice(0, 50).map((item) => ({
    id: item.id,
    title: item.title || "",
    status: item.status || "",
    campaignId: item.campaignId || null,
    hasMedia: Array.isArray(item.mediaRefs) ? item.mediaRefs.length > 0 : Boolean(item.mediaRef),
    updatedAt: item.updatedAt || item.createdAt || null,
  }));
}

/**
 * Evidence-only analytics. Preserve null. Never invent zeros for missing metrics.
 */
export function summarizeAnalytics(snapshots) {
  const facts = (snapshots || []).slice(0, 100).map((snap) => {
    const metrics = snap.metrics && typeof snap.metrics === "object" ? snap.metrics : {};
    const cleaned = {};
    for (const [key, value] of Object.entries(metrics)) {
      if (value == null) cleaned[key] = null;
      else if (typeof value === "number" && Number.isFinite(value)) cleaned[key] = value;
      else if (typeof value === "string" && value.trim() === "") cleaned[key] = null;
      else cleaned[key] = value;
    }
    return {
      id: snap.id,
      platform: snap.platform || null,
      accountId: snap.accountId || null,
      contentId: snap.contentId || null,
      campaignId: snap.campaignId || null,
      source: snap.source || null,
      recordedAt: snap.recordedAt || snap.capturedAt || null,
      metrics: cleaned,
    };
  });
  return {
    facts,
    interpretation: {
      note: "Facts are MetricSnapshot evidence only. Missing values stay null. Unsupported platforms are not claimed.",
    },
    snapshotCount: facts.length,
  };
}

/**
 * Inbox V1 is summary counts only. Message bodies stay private.
 */
export function summarizeInbox(interactions) {
  const rows = interactions || [];
  const byType = {};
  for (const row of rows) {
    const type = String(row.type || "unknown");
    byType[type] = (byType[type] || 0) + 1;
  }
  return {
    interactionCount: rows.length,
    unreadCount: rows.filter((row) => row.read === false).length,
    unhandledCount: rows.filter((row) => row.handled === false).length,
    commentCount: byType.comment || 0,
    mentionCount: byType.mention || 0,
    messageCount: byType.message || byType.dm || 0,
    contentLinkedCount: rows.filter((row) => Boolean(row.contentId)).length,
    campaignLinkedCount: rows.filter((row) => Boolean(row.campaignId)).length,
    byType,
    privacy: "SUMMARY_ONLY",
    note: "Full DM and message bodies are not exposed to external agents in V1.",
  };
}

function countBy(rows, keyFn) {
  const out = {};
  for (const row of rows || []) {
    const key = keyFn(row) || "unknown";
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

export async function buildSanitizedContext({ workspaceId = null, capabilities = [] } = {}) {
  if (!workspaceId) {
    return scrubValue({
      ok: false,
      error: "Workspace binding is required.",
    });
  }
  await initDb();
  const granted = new Set((capabilities || []).map((item) => String(item).toUpperCase()));
  const accounts = scopeRows(await list(COLLECTIONS.accounts), workspaceId);
  const campaigns = scopeRows(await list(COLLECTIONS.campaigns), workspaceId);
  const content = scopeRows(await list(COLLECTIONS.content), workspaceId);
  const queue = scopeRows(await list(COLLECTIONS.queue), workspaceId);
  const analytics = scopeRows(await list(COLLECTIONS.analytics), workspaceId);
  const inbox = scopeRows(await list(COLLECTIONS.inbox), workspaceId);

  const packet = {
    ok: true,
    product: NORTH_STAR,
    runtime: {
      app: runtimeIdentity().app,
      service: runtimeIdentity().service,
      framework: runtimeIdentity().framework,
      uiPort: runtimeIdentity().uiPort,
      version: runtimeIdentity().version,
      gitSha: runtimeIdentity().gitSha,
    },
    workspace: granted.has("READ_WORKSPACE_SUMMARY") ? {
      id: workspaceId,
      accountCount: accounts.length,
      campaignCount: campaigns.length,
      contentCount: content.length,
      queueCount: queue.length,
    } : undefined,
    accounts: granted.has("READ_ACCOUNT_METADATA") ? {
      items: summarizeAccounts(accounts),
      byPlatform: countBy(accounts, (row) => row.platform),
      byConnectionState: countBy(accounts, (row) => row.connectionState),
    } : undefined,
    campaigns: granted.has("READ_CAMPAIGN_SUMMARY") ? {
      items: summarizeCampaigns(campaigns),
    } : undefined,
    content: granted.has("READ_CONTENT_METADATA") ? {
      items: summarizeContent(content),
    } : undefined,
    analytics: granted.has("READ_ANALYTICS_SUMMARY")
      ? summarizeAnalytics(analytics)
      : undefined,
    inbox: granted.has("READ_INBOX_SUMMARY")
      ? summarizeInbox(inbox)
      : undefined,
    providers: granted.has("READ_PRODUCT_CONTEXT")
      ? listProviderDefinitions().map((item) => ({
        provider: item.provider,
        displayName: item.displayName,
        readiness: item.readiness,
        publishingSupport: Boolean(item.publishingSupport),
        mediaDelivery: item.mediaDelivery || undefined,
        pagePosting: item.pagePosting || undefined,
      }))
      : undefined,
    publicMedia: {
      status: publicMediaReadiness().status,
    },
    boundaries: {
      agentMayPublish: false,
      agentMayModifyData: false,
      agentMayAccessTokens: false,
      agentMayReadMessageBodies: false,
      proposalsAutoExecute: false,
      humanOperatorRetainsFinalControl: true,
    },
    retrievedAt: new Date().toISOString(),
  };

  return scrubValue(packet);
}

export async function buildOperationsSummary({ workspaceId = null } = {}) {
  if (!workspaceId) {
    return scrubValue({ ok: false, error: "Workspace binding is required." });
  }
  await initDb();
  let health = null;
  try {
    health = await getDbHealth();
  } catch {
    health = { ok: false };
  }
  const accounts = scopeRows(await list(COLLECTIONS.accounts), workspaceId);
  const queue = scopeRows(await list(COLLECTIONS.queue), workspaceId);
  const approvals = scopeRows(await list(COLLECTIONS.approvals), workspaceId);
  const publications = scopeRows(await list(COLLECTIONS.publications), workspaceId);
  const connected = accounts.filter((row) => row.connectionState === "CONNECTED");
  return scrubValue({
    ok: true,
    database: {
      localHealthy: health?.ok !== false,
      syncState: health?.sync?.state || null,
      cloudConfigured: health?.sync?.cloudConfigured == null ? null : Boolean(health.sync.cloudConfigured),
    },
    social: {
      connectedCount: connected.length,
      platforms: [...new Set(connected.map((row) => row.platform).filter(Boolean))],
    },
    queue: {
      openCount: queue.filter((row) => !["DONE", "CANCELLED", "FAILED"].includes(String(row.status || row.state || "").toUpperCase())).length,
      total: queue.length,
    },
    approvals: {
      pendingCount: approvals.filter((row) => String(row.status || "").toUpperCase() === "PENDING").length,
      total: approvals.length,
    },
    publications: {
      total: publications.length,
    },
    reminder: "Operational counts are summaries only. External agents cannot publish, approve, or mutate records.",
    retrievedAt: new Date().toISOString(),
  });
}
