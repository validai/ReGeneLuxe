import { COLLECTIONS, list, upsert, enqueueJob, listJobs, JOB_TYPES } from "../db/index.js";
import { nowIso, createId } from "../../src/data/ids.js";
import { getAccountTokens } from "../secrets/providers.js";
import { friendlyGoogleApiError } from "../auth/googleErrors.js";
import { stripSecretFields } from "../../src/data/secretFields.js";
import { gmailConnector } from "./providers/gmail.js";
import { assertMatchesSignedInGoogleAccount } from "../../src/data/googleIdentity.js";
import { GMAIL_READONLY_SCOPE } from "../auth/googleScopes.js";
import { PROFILE_CONNECTION_STATES } from "../../src/data/profileModels.js";
import { upsertProfileConnection } from "../db/managedProfileRepository.js";
import { getOperator } from "../db/operatorRepository.js";
import { gmailBrainSignals } from "../../src/data/gmailSignals.js";

export { gmailBrainSignals };

export const GMAIL_SYNC_WINDOW_DAYS = 30;
export const GMAIL_SYNC_MAX_MESSAGES = 500;
export const GMAIL_PROVIDER = "gmail";

function header(payload, name) {
  const headers = payload?.payload?.headers || payload?.headers || [];
  const row = headers.find((item) => String(item.name || "").toLowerCase() === name.toLowerCase());
  return row?.value || "";
}

function countAttachments(payload) {
  const parts = payload?.payload?.parts;
  if (!Array.isArray(parts)) return payload?.payload?.filename ? 1 : 0;
  return parts.filter((part) => part.filename || part.body?.attachmentId).length;
}

export function nextGmailSyncCursor(listed = {}, mailbox = {}, previous = {}) {
  if (listed.reachedCap && listed.nextPageToken) {
    return {
      listPageToken: listed.nextPageToken,
      historyId: previous.historyId || mailbox.historyId || "",
      reachedCap: true,
    };
  }
  return {
    listPageToken: "",
    historyId: listed.historyId || mailbox.historyId || previous.historyId || "",
    reachedCap: false,
  };
}

export function applyGmailSyncOutcome(connection, synced = {}) {
  const attemptedAt = synced.lastAttemptedSyncAt || nowIso();
  const indexedCount = synced.indexedCount == null
    ? connection.indexedCount
    : Number(synced.indexedCount);
  const progressed = Boolean(synced.ok || synced.createdCount || synced.updatedCount || synced.created || synced.updated);
  if (synced.ok) {
    return {
      ...connection,
      status: PROFILE_CONNECTION_STATES.CONNECTED,
      connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
      indexedCount,
      createdCount: synced.createdCount || synced.created || 0,
      updatedCount: synced.updatedCount || synced.updated || 0,
      lastAttemptedSyncAt: attemptedAt,
      lastSuccessfulSyncAt: synced.lastSuccessfulSyncAt || nowIso(),
      lastSyncAt: synced.lastSuccessfulSyncAt || nowIso(),
      lastErrorCode: "",
      lastErrorSummary: "",
      jobStatus: "Idle",
      syncState: "Idle",
      syncCursor: synced.syncCursor || null,
      mailbox: synced.mailbox || connection.mailbox,
      notes: "",
      updatedAt: nowIso(),
    };
  }
  const state = synced.connectionState || PROFILE_CONNECTION_STATES.ERROR;
  const retryable = Boolean(synced.retryable);
  const keepUsable = retryable && state !== PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED
    && state !== PROFILE_CONNECTION_STATES.SETUP_REQUIRED;
  return {
    ...connection,
    status: keepUsable ? PROFILE_CONNECTION_STATES.CONNECTED : state,
    connectionState: keepUsable ? PROFILE_CONNECTION_STATES.CONNECTED : state,
    indexedCount,
    createdCount: synced.createdCount || synced.created || 0,
    updatedCount: synced.updatedCount || synced.updated || 0,
    lastAttemptedSyncAt: attemptedAt,
    lastSuccessfulSyncAt: progressed ? (synced.lastSuccessfulSyncAt || nowIso()) : connection.lastSuccessfulSyncAt,
    lastSyncAt: progressed ? (synced.lastSuccessfulSyncAt || nowIso()) : connection.lastSyncAt,
    lastErrorCode: synced.code || state,
    lastErrorSummary: synced.error || "Gmail sync failed.",
    jobStatus: retryable ? "Retry" : "Error",
    syncState: retryable ? "Retry" : "Error",
    notes: synced.error || connection.notes || "",
    updatedAt: nowIso(),
  };
}

export function publicGmailMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    managedProfileId: row.managedProfileId,
    provider: GMAIL_PROVIDER,
    providerMessageId: row.providerMessageId,
    threadId: row.threadId || "",
    from: row.from || "",
    to: row.to || "",
    cc: row.cc || "",
    subject: row.subject || "",
    sentAt: row.sentAt || null,
    receivedAt: row.receivedAt || row.timestamp || null,
    labels: Array.isArray(row.labels) ? row.labels : [],
    snippet: row.snippet || "",
    hasAttachments: Boolean(row.hasAttachments),
    attachmentCount: Number(row.attachmentCount) || 0,
    providerHistoryId: row.providerHistoryId || "",
  };
}

export function normalizeGmailMessage(payload, { previous, connection } = {}) {
  const receivedAt = payload.internalDate
    ? new Date(Number(payload.internalDate)).toISOString()
    : header(payload, "Date") || null;
  const attachmentCount = countAttachments(payload);
  const record = {
    id: previous?.id || createId("gml"),
    managedProfileId: connection.managedProfileId,
    ownerOperatorId: connection.ownerOperatorId || "",
    connectionId: connection.id,
    provider: GMAIL_PROVIDER,
    providerMessageId: payload.id,
    threadId: payload.threadId || "",
    from: header(payload, "From"),
    to: header(payload, "To"),
    cc: header(payload, "Cc"),
    subject: header(payload, "Subject"),
    sentAt: header(payload, "Date") || receivedAt,
    receivedAt,
    labels: Array.isArray(payload.labelIds) ? payload.labelIds : [],
    snippet: String(payload.snippet || "").slice(0, 240),
    hasAttachments: attachmentCount > 0,
    attachmentCount,
    providerHistoryId: payload.historyId != null ? String(payload.historyId) : (previous?.providerHistoryId || ""),
    createdAt: previous?.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
  delete record.body;
  delete record.bodyHtml;
  delete record.raw;
  delete record.payload;
  return stripSecretFields(record);
}

export async function listGmailMessagesForProfile(managedProfileId) {
  if (!managedProfileId) return [];
  const rows = await list(COLLECTIONS.gmail_messages);
  return rows.filter((row) => row.managedProfileId === managedProfileId);
}

export async function countGmailMessagesForProfile(managedProfileId) {
  return (await listGmailMessagesForProfile(managedProfileId)).length;
}

export function displayGmailJobStatus(job) {
  if (!job) return "Idle";
  if (job.state === "RUNNING") return "Syncing";
  if (job.state === "PENDING") return "Syncing";
  if (job.state === "ERROR") return "Retry";
  if (job.state === "FAILED") return "Error";
  return "Idle";
}

export async function latestGmailSyncJob(connectionId) {
  if (!connectionId) return null;
  const jobs = await listJobs({ limit: 40 });
  return jobs.find((job) => job.type === JOB_TYPES.SYNC_GMAIL && job.payload?.connectionId === connectionId) || null;
}

async function gmailFetch(path, accessToken) {
  let res;
  try {
    res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    return {
      ok: false,
      code: "UNAVAILABLE",
      connectionState: PROFILE_CONNECTION_STATES.ERROR,
      retryable: true,
      error: "Gmail is temporarily unavailable. ReGeneLuxe will retry.",
    };
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) {
      return {
        ok: false,
        code: "RATE_LIMITED",
        connectionState: PROFILE_CONNECTION_STATES.ERROR,
        retryable: true,
        error: "Gmail is temporarily unavailable. ReGeneLuxe will retry.",
      };
    }
    const mapped = friendlyGoogleApiError(json, res.status, "gmail");
    return { ok: false, ...mapped, retryable: Boolean(mapped.retryable) };
  }
  return { ok: true, json };
}

async function gmailFetchWithRetry(path, accessToken, { retries = 5 } = {}) {
  let last;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    last = await gmailFetch(path, accessToken);
    if (last.ok || !last.retryable) return last;
    const waitMs = Math.min(1000 * 2 ** attempt, 20000);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  return last;
}

export async function verifyGmailAccess({ connection, operator } = {}) {
  if (!connection?.id) {
    return { ok: false, connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED, error: "Gmail is not connected." };
  }
  let tokens = getAccountTokens("gmail", connection.id);
  if (!tokens?.accessToken && !tokens?.refreshToken) {
    return { ok: false, connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED, error: "Gmail is not connected." };
  }
  const scopes = tokens.scopes || connection.grantedScopes || [];
  if (scopes.length && !scopes.includes(GMAIL_READONLY_SCOPE)) {
    return {
      ok: false,
      connectionState: PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: "Gmail was not granted read access. Approve gmail.readonly and try again.",
    };
  }

  const expired = tokens.expiresAt && new Date(tokens.expiresAt).getTime() < Date.now() + 60_000;
  let verified;
  if (!tokens.accessToken || expired) {
    verified = await gmailConnector._refreshAuth({ id: connection.id }, tokens);
  } else {
    verified = await gmailConnector.getProfile({ id: connection.id });
    if (!verified.ok && tokens.refreshToken) {
      verified = await gmailConnector._refreshAuth({ id: connection.id }, tokens);
    }
  }
  if (!verified.ok) return verified;

  if (operator) {
    const identity = assertMatchesSignedInGoogleAccount(operator, {
      googleSub: verified.profile?.googleAccountSub,
      email: verified.profile?.email,
    });
    if (!identity.ok) {
      return { ok: false, connectionState: PROFILE_CONNECTION_STATES.ERROR, error: identity.error };
    }
  }
  return verified;
}

async function listWindowMessageIds(accessToken, { pageToken = "", max = GMAIL_SYNC_MAX_MESSAGES } = {}) {
  const ids = [];
  let next = pageToken || "";
  do {
    const remaining = max - ids.length;
    const params = new URLSearchParams({
      q: `newer_than:${GMAIL_SYNC_WINDOW_DAYS}d`,
      maxResults: String(Math.min(100, remaining)),
    });
    if (next) params.set("pageToken", next);
    const listed = await gmailFetchWithRetry(`messages?${params.toString()}`, accessToken);
    if (!listed.ok) return listed;
    ids.push(...(listed.json.messages || []).map((item) => item.id).filter(Boolean));
    next = listed.json.nextPageToken || "";
    if (ids.length >= max) {
      return { ok: true, ids: ids.slice(0, max), nextPageToken: next, reachedCap: Boolean(next) };
    }
  } while (next);
  return { ok: true, ids, nextPageToken: "", reachedCap: false };
}

async function listHistoryMessageIds(accessToken, startHistoryId, max) {
  const ids = [];
  let next = "";
  let historyId = startHistoryId;
  do {
    const params = new URLSearchParams({
      startHistoryId: String(startHistoryId),
      historyTypes: "messageAdded",
      maxResults: "100",
    });
    if (next) params.set("pageToken", next);
    const listed = await gmailFetchWithRetry(`history?${params.toString()}`, accessToken);
    if (!listed.ok) return listed;
    for (const item of listed.json.history || []) {
      for (const added of item.messagesAdded || []) {
        if (added.message?.id) ids.push(added.message.id);
      }
    }
    historyId = listed.json.historyId || historyId;
    next = listed.json.nextPageToken || "";
    if (ids.length >= max) {
      return { ok: true, ids: [...new Set(ids)].slice(0, max), historyId, reachedCap: true };
    }
  } while (next);
  return { ok: true, ids: [...new Set(ids)], historyId, reachedCap: false };
}

async function storeMessages(connection, ids, accessToken) {
  const existing = await listGmailMessagesForProfile(connection.managedProfileId);
  const byProviderId = new Map(existing.map((row) => [row.providerMessageId, row]));
  let created = 0;
  let updated = 0;
  for (const id of ids) {
    const detail = await gmailFetchWithRetry(
      `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`,
      accessToken,
    );
    if (!detail.ok) {
      if (detail.connectionState === PROFILE_CONNECTION_STATES.SETUP_REQUIRED || detail.connectionState === PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED) {
        return { ...detail, created, updated, indexedCount: byProviderId.size };
      }
      if (detail.retryable) return { ...detail, created, updated, indexedCount: byProviderId.size };
      continue;
    }
    const previous = byProviderId.get(id);
    const record = normalizeGmailMessage(detail.json, { previous, connection });
    await upsert(COLLECTIONS.gmail_messages, record);
    if (previous) updated += 1;
    else created += 1;
    byProviderId.set(id, record);
  }
  return { ok: true, created, updated, indexedCount: byProviderId.size };
}

export async function syncGmailMessages({ connection, accessToken, operator } = {}) {
  const attemptedAt = nowIso();
  if (!connection?.id || !connection.managedProfileId) {
    return { ok: false, error: "Gmail connection is missing.", indexedCount: 0, lastAttemptedSyncAt: attemptedAt };
  }
  const verified = await verifyGmailAccess({ connection, operator });
  if (!verified.ok) {
    return { ...verified, lastAttemptedSyncAt: attemptedAt };
  }
  const token = accessToken || getAccountTokens("gmail", connection.id)?.accessToken;
  if (!token) {
    return {
      ok: false,
      connectionState: PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: "Gmail access was revoked. Reconnect Gmail to continue syncing.",
      indexedCount: 0,
      lastAttemptedSyncAt: attemptedAt,
    };
  }

  const cursor = connection.syncCursor && typeof connection.syncCursor === "object" ? connection.syncCursor : {};
  const useHistory = Boolean(cursor.historyId && connection.lastSuccessfulSyncAt);
  let listed;
  if (useHistory) {
    listed = await listHistoryMessageIds(token, cursor.historyId, GMAIL_SYNC_MAX_MESSAGES);
    if (!listed.ok && listed.connectionState !== PROFILE_CONNECTION_STATES.SETUP_REQUIRED && listed.connectionState !== PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED) {
      listed = await listWindowMessageIds(token, { max: GMAIL_SYNC_MAX_MESSAGES });
    }
  } else if (cursor.listPageToken) {
    listed = await listWindowMessageIds(token, { pageToken: cursor.listPageToken, max: GMAIL_SYNC_MAX_MESSAGES });
  } else {
    listed = await listWindowMessageIds(token, { max: GMAIL_SYNC_MAX_MESSAGES });
  }
  if (!listed.ok) {
    return { ...listed, indexedCount: 0, lastAttemptedSyncAt: attemptedAt };
  }

  const stored = await storeMessages(connection, listed.ids, token);
  if (!stored.ok) {
    return {
      ...stored,
      createdCount: stored.created,
      updatedCount: stored.updated,
      lastAttemptedSyncAt: attemptedAt,
      lastSuccessfulSyncAt: (stored.created || stored.updated) ? nowIso() : undefined,
    };
  }

  const mailbox = verified.profile?.mailbox || {};
  const nextCursor = {
    listPageToken: "",
    historyId: mailbox.historyId || listed.historyId || cursor.historyId || "",
    reachedCap: Boolean(listed.reachedCap),
  };

  return {
    ok: true,
    indexedCount: stored.indexedCount,
    createdCount: stored.created,
    updatedCount: stored.updated,
    windowDays: GMAIL_SYNC_WINDOW_DAYS,
    reachedCap: Boolean(nextCursor.reachedCap),
    syncCursor: nextCursor,
    mailbox,
    lastAttemptedSyncAt: attemptedAt,
    lastSuccessfulSyncAt: nowIso(),
  };
}

export async function enqueueGmailSync(connection) {
  if (!connection?.id) return null;
  return enqueueJob({
    type: JOB_TYPES.SYNC_GMAIL,
    payload: {
      connectionId: connection.id,
      managedProfileId: connection.managedProfileId,
    },
    idempotencyKey: `sync_gmail:${connection.id}:${nowIso()}`,
  });
}

export async function runGmailSyncJob(payload = {}) {
  const rows = await list(COLLECTIONS.profile_connections);
  const connection = rows.find((row) => row.id === payload.connectionId) || null;
  if (!connection) throw new Error("Gmail connection not found.");
  const operator = connection.ownerOperatorId
    ? await getOperator(connection.ownerOperatorId)
    : null;

  await upsertProfileConnection({
    ...connection,
    status: PROFILE_CONNECTION_STATES.SYNCING,
    connectionState: PROFILE_CONNECTION_STATES.SYNCING,
    jobStatus: "Syncing",
    syncState: "Syncing",
    lastAttemptedSyncAt: nowIso(),
    updatedAt: nowIso(),
  });

  const synced = await syncGmailMessages({ connection, operator });
  const next = applyGmailSyncOutcome(connection, synced);
  await upsertProfileConnection(next);

  if (!synced.ok) {
    const err = new Error(synced.error || "Gmail sync failed.");
    err.code = synced.retryable ? "RATE_LIMITED" : (synced.code || "PROVIDER_ERROR");
    throw err;
  }
  return synced;
}
