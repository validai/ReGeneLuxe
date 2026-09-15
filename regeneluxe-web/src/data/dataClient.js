/**
 * Same-origin API client for SQLite-backed operational data.
 * Never sends secrets.
 */

function stripSecrets(record) {
  if (!record || typeof record !== "object") return record;
  const next = { ...record };
  delete next.accessToken;
  delete next.refreshToken;
  delete next.token;
  delete next.apiKey;
  delete next.clientSecret;
  delete next.authorization;
  return next;
}

export async function apiUpsertRecord(collection, record) {
  const response = await fetch("/api/data/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection, record: stripSecrets(record) }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Failed to persist ${collection}`);
  }
  return body.record || record;
}

export async function apiRemoveRecord(collection, id) {
  const response = await fetch("/api/data/collection", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection, id }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || `Failed to remove ${collection}/${id}`);
  }
  return true;
}

export async function apiSetMeta(meta) {
  const response = await fetch("/api/data/collection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.ok === false) {
    throw new Error(body.error || "Failed to persist meta");
  }
  return true;
}

export async function apiFetchSnapshot() {
  const response = await fetch("/api/data/snapshot");
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.data) {
    throw new Error(body.error || "Failed to load data snapshot");
  }
  return body.data;
}

export async function apiRunSync({ pull = true, push = true } = {}) {
  const response = await fetch("/api/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pull, push }),
  });
  return response.json().catch(() => ({ ok: false }));
}

/**
 * Fire-and-forget persist — updates are already in the operational store.
 * Failures surface via sync status / pending outbox, not by rolling back UI.
 */
export function queuePersistRecord(collection, record) {
  if (typeof window === "undefined") return;
  apiUpsertRecord(collection, record).catch((error) => {
    console.error("[dataClient] persist failed", collection, record?.id, error);
  });
}

export function queueRemoveRecord(collection, id) {
  if (typeof window === "undefined") return;
  apiRemoveRecord(collection, id).catch((error) => {
    console.error("[dataClient] remove failed", collection, id, error);
  });
}

export function queueSetMeta(meta) {
  if (typeof window === "undefined") return;
  apiSetMeta(meta).catch((error) => {
    console.error("[dataClient] meta failed", error);
  });
}
