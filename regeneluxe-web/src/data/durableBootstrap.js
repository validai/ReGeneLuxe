import { STORAGE_KEYS, hasStorage, writeString } from "./storage.js";
import {
  hydrateFromSnapshot,
  setOperationalPrimary,
  isOperationalPrimary,
} from "./operationalStore.js";
import { apiRunSync } from "./dataClient.js";

const MIGRATION_FLAG = "rl_db_migration";

let durableReady = false;
let lastDbHealth = null;
let lastSync = null;
let bootError = null;

export function isDurableReady() {
  return durableReady;
}

/** @deprecated Operational dual-write retired; always false after Phase 1. */
export function isDualWriteEnabled() {
  return false;
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

async function refreshSync() {
  try {
    const response = await fetch("/api/sync");
    if (response.ok) lastSync = await response.json();
  } catch {
    lastSync = { state: "ERROR", cloudConfigured: false, pendingOutbox: 0, ok: false };
  }
}

/**
 * Product boot:
 * 1. Open local SQLite (via health)
 * 2. Migrate operational localStorage → SQLite (idempotent + backup)
 * 3. Hydrate operationalStore from SQLite snapshot (canonical)
 * 4. Optionally pull/push Turso (non-blocking; app works offline)
 *
 * Does NOT re-enable localStorage dual-write for operational entities.
 * UI prefs remain in localStorage.
 */
export async function bootstrapDurableStore() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (durableReady && isOperationalPrimary()) {
    return { ok: true, already: true, health: lastDbHealth, sync: lastSync };
  }

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
    if (!snapRes.ok || !snapBody.data) {
      bootError = snapBody.error || "Failed to hydrate from local database";
      return { ok: false, error: bootError };
    }

    hydrateFromSnapshot(snapBody.data);
    setOperationalPrimary(true);
    writeString(MIGRATION_FLAG, "complete_v1");
    durableReady = true;
    await refreshSync();

    // Best-effort cloud reconcile (pull then push). App stays usable if this fails.
    apiRunSync({ pull: true, push: true }).then(async () => {
      await refreshSync();
      try {
        const again = await fetch("/api/data/snapshot");
        const body = await again.json();
        if (again.ok && body.data) hydrateFromSnapshot(body.data);
      } catch {
        /* offline ok */
      }
    }).catch(() => {});

    return {
      ok: true,
      migrate: migrateBody,
      health: lastDbHealth,
      sync: lastSync,
      authority: "sqlite",
    };
  } catch (error) {
    bootError = error instanceof Error ? error.message : String(error);
    return { ok: false, error: bootError };
  }
}

/** @deprecated No-op — operational dual-write retired. */
export function persistCollectionToSqlite() {
  return undefined;
}

export async function fetchDbHealth() {
  try {
    const response = await fetch("/api/db/health");
    lastDbHealth = await response.json();
    await refreshSync();
    if (lastSync) {
      lastDbHealth = {
        ...lastDbHealth,
        sync: {
          ...(lastDbHealth.sync || {}),
          ...lastSync,
        },
      };
    }
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

/** Debug helper for Settings / tests */
export function getAuthorityLabel() {
  if (isOperationalPrimary()) return "sqlite";
  return "localStorage";
}
