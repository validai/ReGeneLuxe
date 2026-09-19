import { COLLECTIONS, list, upsert } from "../db/index.js";
import { nowIso, createId } from "../../src/data/ids.js";
import { getAccountTokens } from "../secrets/providers.js";
import { friendlyGoogleApiError } from "../auth/googleErrors.js";
import { stripSecretFields } from "../../src/data/secretFields.js";

export const GMAIL_SYNC_WINDOW_DAYS = 30;
export const GMAIL_SYNC_MAX_MESSAGES = 80;

function header(payload, name) {
  const headers = payload?.payload?.headers || [];
  const row = headers.find((item) => String(item.name || "").toLowerCase() === name.toLowerCase());
  return row?.value || "";
}

function hasAttachments(payload) {
  const parts = payload?.payload?.parts;
  if (!Array.isArray(parts)) return Boolean(payload?.payload?.filename);
  return parts.some((part) => part.filename || part.body?.attachmentId);
}

export function gmailBrainSignals(connection, indexedCount = 0) {
  return {
    connected: connection?.status === "CONNECTED",
    lastSync: connection?.lastSuccessfulSyncAt || connection?.lastSyncAt || null,
    indexedCount: Number(indexedCount) || 0,
    permission: "readonly",
  };
}

export function publicGmailMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    managedProfileId: row.managedProfileId,
    providerMessageId: row.providerMessageId,
    threadId: row.threadId,
    from: row.from || "",
    to: row.to || "",
    subject: row.subject || "",
    timestamp: row.timestamp || null,
    labels: Array.isArray(row.labels) ? row.labels : [],
    snippet: row.snippet || "",
    hasAttachments: Boolean(row.hasAttachments),
  };
}

export async function listGmailMessagesForProfile(managedProfileId) {
  if (!managedProfileId) return [];
  const rows = await list(COLLECTIONS.gmail_messages);
  return rows.filter((row) => row.managedProfileId === managedProfileId);
}

export async function countGmailMessagesForProfile(managedProfileId) {
  return (await listGmailMessagesForProfile(managedProfileId)).length;
}

async function gmailFetch(path, accessToken) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, ...friendlyGoogleApiError(json, res.status, "gmail") };
  }
  return { ok: true, json };
}

export async function syncGmailMessages({ connection, accessToken } = {}) {
  const attemptedAt = nowIso();
  if (!connection?.id || !connection.managedProfileId) {
    return { ok: false, error: "Gmail connection is missing.", indexedCount: 0, lastAttemptedSyncAt: attemptedAt };
  }
  const token = accessToken || getAccountTokens("gmail", connection.id)?.accessToken;
  if (!token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: "Gmail needs to be reconnected.",
      indexedCount: 0,
      lastAttemptedSyncAt: attemptedAt,
    };
  }

  const listed = await gmailFetch(
    `messages?q=${encodeURIComponent(`newer_than:${GMAIL_SYNC_WINDOW_DAYS}d`)}&maxResults=${GMAIL_SYNC_MAX_MESSAGES}`,
    token,
  );
  if (!listed.ok) {
    return { ...listed, indexedCount: 0, lastAttemptedSyncAt: attemptedAt };
  }

  const ids = (listed.json.messages || []).map((item) => item.id).filter(Boolean).slice(0, GMAIL_SYNC_MAX_MESSAGES);
  const existing = await listGmailMessagesForProfile(connection.managedProfileId);
  const byProviderId = new Map(existing.map((row) => [row.providerMessageId, row]));
  let stored = 0;

  for (const id of ids) {
    const detail = await gmailFetch(
      `messages/${encodeURIComponent(id)}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`,
      token,
    );
    if (!detail.ok) {
      if (detail.connectionState === "SETUP_REQUIRED" || detail.connectionState === "RECONNECT_REQUIRED") {
        return { ...detail, indexedCount: stored, lastAttemptedSyncAt: attemptedAt };
      }
      continue;
    }
    const payload = detail.json;
    const previous = byProviderId.get(id);
    const record = {
      id: previous?.id || createId("gml"),
      managedProfileId: connection.managedProfileId,
      ownerOperatorId: connection.ownerOperatorId,
      connectionId: connection.id,
      providerMessageId: id,
      threadId: payload.threadId || "",
      from: header(payload, "From"),
      to: header(payload, "To"),
      subject: header(payload, "Subject"),
      timestamp: payload.internalDate
        ? new Date(Number(payload.internalDate)).toISOString()
        : header(payload, "Date") || null,
      labels: Array.isArray(payload.labelIds) ? payload.labelIds : [],
      snippet: String(payload.snippet || "").slice(0, 240),
      hasAttachments: hasAttachments(payload),
      createdAt: previous?.createdAt || nowIso(),
      updatedAt: nowIso(),
    };
    delete record.body;
    delete record.bodyHtml;
    delete record.raw;
    await upsert(COLLECTIONS.gmail_messages, stripSecretFields(record));
    stored += 1;
  }

  return {
    ok: true,
    indexedCount: stored,
    windowDays: GMAIL_SYNC_WINDOW_DAYS,
    lastAttemptedSyncAt: attemptedAt,
    lastSuccessfulSyncAt: nowIso(),
  };
}
