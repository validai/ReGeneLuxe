/** Safe Campaign Brain fields only. Never include Gmail content. */

export const GMAIL_BRAIN_KEYS = ["gmailConnected", "gmailLastSyncAt", "gmailFreshness"];

export const GMAIL_PRIVATE_FIELDS = [
  "from",
  "to",
  "cc",
  "subject",
  "snippet",
  "body",
  "bodyHtml",
  "raw",
  "payload",
  "providerMessageId",
  "threadId",
  "labels",
  "gmail_messages",
  "gmailMessages",
];

export function gmailBrainSignals(connection = {}) {
  const lastSync = connection.lastSuccessfulSyncAt
    || connection.lastSyncAt
    || connection.gmailLastSyncAt
    || connection.gmailFreshness
    || null;
  const connected = connection.status === "CONNECTED"
    || connection.status === "SYNCING"
    || connection.gmailConnected === true
    || connection.connected === true;
  return {
    gmailConnected: Boolean(connected),
    gmailLastSyncAt: lastSync,
    gmailFreshness: lastSync,
  };
}

export function looksLikeGmailRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return value.provider === "gmail"
    || value.kind === "GMAIL"
    || Boolean(value.providerMessageId)
    || Boolean(value.gmail_messages)
    || Boolean(value.gmailMessages);
}
