import { STORAGE_KEYS, replaceAll, hasStorage, writeString, readJson } from "./storage.js";

const MIGRATION_FLAG = "rl_db_migration";

let durableReady = false;
let dualWrite = false;
let lastDbHealth = null;
let lastSync = null;
let bootError = null;

export function isDurableReady() {
  return durableReady;
}

export function isDualWriteEnabled() {
  return dualWrite;
}

export function getLastDbHealth() {
  return lastDbHealth;
}

export function getLastSyncStatus() {
  return lastSync;
}

export function getDurableBootError() {
  return bootError;
}

function collectLocalStorageDump() {
  if (!hasStorage()) return {};
  const dump = {};
  const keys = [
    ...Object.values(STORAGE_KEYS),
    "rl_sidebar_collapsed",
    "rl_content_view",
    "rl_calendar_view",
    MIGRATION_FLAG,
  ];
  for (const key of keys) {
    try {
      const value = window.localStorage.getItem(key);
      if (value != null) dump[key] = value;
    } catch {
      /* ignore */
    }
  }
  return dump;
}

function hydrateLocalStorageFromSnapshot(data) {
  if (!data || !hasStorage()) return;
  const entries = {
    [STORAGE_KEYS.campaigns]: data.campaigns || [],
    [STORAGE_KEYS.accounts]: data.accounts || [],
    [STORAGE_KEYS.content]: data.content || [],
    [STORAGE_KEYS.inbox]: data.inbox || [],
    [STORAGE_KEYS.analytics]: data.analytics || [],
    [STORAGE_KEYS.queue]: data.queue || [],
    [STORAGE_KEYS.decisions]: data.decisions || [],
    [STORAGE_KEYS.activity]: data.activity || [],
    [STORAGE_KEYS.events]: data.events || [],
    [STORAGE_KEYS.settings]: data.settings || { id: "app" },
    [STORAGE_KEYS.schemaVersion]: "4",
  };
  if (data.activeCampaignId) entries[STORAGE_KEYS.activeCampaignId] = data.activeCampaignId;
  if (data.workingAccountId) entries[STORAGE_KEYS.workingAccountId] = data.workingAccountId;
  replaceAll(entries);
}

function localStorageLooksEmpty() {
  const campaigns = readJson(STORAGE_KEYS.campaigns, []);
  const accounts = readJson(STORAGE_KEYS.accounts, []);
  const content = readJson(STORAGE_KEYS.content, []);
  return (!Array.isArray(campaigns) || campaigns.length === 0)
    && (!Array.isArray(accounts) || accounts.length === 0)
    && (!Array.isArray(content) || content.length === 0);
}

async function refreshSync() {
  try {
    const response = await fetch("/api/sync");
    if (response.ok) lastSync = await response.json();
  } catch {
    lastSync = { state: "ERROR", cloudConfigured: false, pendingOutbox: 0 };
  }
}

/**
 * Product boot: init local SQLite, migrate localStorage once, enable dual-write.
 * Safe to call multiple times. No-ops outside the browser.
 */
export async function bootstrapDurableStore() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (durableReady) return { ok: true, already: true, health: lastDbHealth, sync: lastSync };

  try {
    const healthRes = await fetch("/api/db/health");
    lastDbHealth = await healthRes.json();
    if (!healthRes.ok || lastDbHealth?.ok === false) {
      bootError = lastDbHealth?.local?.error || "Local database unhealthy";
      return { ok: false, error: bootError, health: lastDbHealth };
    }

    const dump = collectLocalStorageDump();
    const migrateRes = await fetch("/api/migrate/local-storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dump }),
    });
    const migrateBody = await migrateRes.json();
    if (!migrateRes.ok) {
      bootError = migrateBody.error || "Migration failed";
      return { ok: false, error: bootError, migrate: migrateBody };
    }

    const snapRes = await fetch("/api/data/snapshot");
    const snapBody = await snapRes.json();
    if (snapRes.ok && snapBody.data && localStorageLooksEmpty()) {
      const remoteHasData = (snapBody.data.campaigns?.length || 0)
        + (snapBody.data.accounts?.length || 0)
        + (snapBody.data.content?.length || 0) > 0;
      if (remoteHasData) hydrateLocalStorageFromSnapshot(snapBody.data);
    }

    writeString(MIGRATION_FLAG, "complete_v1");
    dualWrite = true;
    durableReady = true;
    await refreshSync();

    // Best-effort remote sync job (non-blocking)
    fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enqueueOnly: true }),
    }).catch(() => {});

    return {
      ok: true,
      migrate: migrateBody,
      health: lastDbHealth,
      sync: lastSync,
    };
  } catch (error) {
    bootError = error instanceof Error ? error.message : String(error);
    return { ok: false, error: bootError };
  }
}

const KEY_TO_COLLECTION = {
  [STORAGE_KEYS.campaigns]: "campaigns",
  [STORAGE_KEYS.accounts]: "accounts",
  [STORAGE_KEYS.content]: "content",
  [STORAGE_KEYS.inbox]: "inbox",
  [STORAGE_KEYS.analytics]: "analytics",
  [STORAGE_KEYS.queue]: "queue",
  [STORAGE_KEYS.decisions]: "decisions",
  [STORAGE_KEYS.activity]: "activity",
  [STORAGE_KEYS.events]: "events",
  [STORAGE_KEYS.settings]: "settings",
  [STORAGE_KEYS.campaignSnapshots]: "campaign_snapshots",
};

/** Fire-and-forget durable persist after localStorage write. */
export function persistCollectionToSqlite(key, value) {
  if (!dualWrite) return;
  const collection = KEY_TO_COLLECTION[key];
  if (!collection) {
    if (key === STORAGE_KEYS.activeCampaignId || key === STORAGE_KEYS.workingAccountId) {
      const meta = {};
      if (key === STORAGE_KEYS.activeCampaignId) meta.active_campaign_id = value;
      if (key === STORAGE_KEYS.workingAccountId) meta.working_account_id = value;
      fetch("/api/data/collection", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meta }),
      }).catch(() => {});
    }
    return;
  }

  const records = collection === "settings"
    ? [{ id: "app", ...(value && typeof value === "object" ? value : {}) }]
    : (Array.isArray(value) ? value : []);

  fetch("/api/data/collection", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collection, records }),
  }).catch(() => {});
}

export async function fetchDbHealth() {
  try {
    const response = await fetch("/api/db/health");
    lastDbHealth = await response.json();
    return lastDbHealth;
  } catch (error) {
    lastDbHealth = {
      ok: false,
      local: { healthy: false, error: error instanceof Error ? error.message : String(error) },
      sync: { state: "Offline", cloudConfigured: false, pendingOutbox: 0 },
    };
    return lastDbHealth;
  }
}
