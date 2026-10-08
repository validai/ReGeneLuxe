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
let bootFlight = null;
let healthEpoch = 0;
let healthFlight = null;
let syncFlight = null;
let snapshotEpoch = 0;
let snapshotFlight = null;

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

/** Test helper — clears cached health so fetch-failure cases start unknown. */
export function resetDurableHealthForTests() {
  lastDbHealth = null;
  lastSync = null;
  bootError = null;
  durableReady = false;
  bootFlight = null;
  healthEpoch = 0;
  healthFlight = null;
  syncFlight = null;
  snapshotEpoch = 0;
  snapshotFlight = null;
}

function collectLocalStorageDump() {
  if (!hasStorage()) return {};
  const dump = {};
  const keys = [
    ...Object.values(STORAGE_KEYS),
    "rl_sidebar_collapsed",
    "regeneluxe.sidebarCollapsed",
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

function applyHealthBody(body, responseOk) {
  lastDbHealth = {
    ...body,
    fetchFailed: body.fetchFailed === true || responseOk === false,
  };
  lastSync = body.sync;
  return lastDbHealth;
}

function healthFromFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  const previousHealth = lastDbHealth && typeof lastDbHealth === "object" ? lastDbHealth : {};
  const previous = previousHealth.sync || lastSync || {};
  const configuredKnown = previous.cloudConfigured === true || previous.cloudConfigured === false;
  lastDbHealth = {
    ok: false,
    fetchFailed: true,
    error: message,
    local: configuredKnown
      ? { ...previousHealth.local, error: message }
      : { healthy: null, error: message },
    sync: configuredKnown
      ? {
        ...previous,
        cloudReachable: previous.cloudConfigured ? false : previous.cloudReachable,
        state: previous.cloudConfigured ? "OFFLINE" : (previous.state || "LOCAL_ONLY"),
        error: message,
      }
      : {
        cloudConfigured: null,
        cloudReachable: null,
        state: "UNKNOWN",
        lastSyncAt: null,
        pendingOutbox: null,
        pendingJobs: null,
        error: message,
      },
  };
  lastSync = lastDbHealth.sync;
  return lastDbHealth;
}

async function readDbHealth() {
  const response = await fetch("/api/db/health", { cache: "no-store", credentials: "same-origin" });
  const body = await response.json().catch(() => null);
  if (!body || typeof body !== "object" || !body.sync || typeof body.sync !== "object") {
    throw new Error(body?.local?.error || body?.error || "Database health unavailable");
  }
  return { body, responseOk: response.ok };
}

/**
 * Concurrent callers share one health request.
 * A request that started before a newer health epoch does not overwrite the newer result.
 */
export async function fetchDbHealth() {
  if (healthFlight && healthFlight.epoch === healthEpoch) return healthFlight.promise;
  const epoch = healthEpoch;
  let promise;
  promise = readDbHealth()
    .then(({ body, responseOk }) => {
      if (epoch !== healthEpoch) return fetchDbHealth();
      return applyHealthBody(body, responseOk);
    })
    .catch((error) => {
      if (epoch !== healthEpoch) return fetchDbHealth();
      return healthFromFailure(error);
    })
    .finally(() => {
      if (healthFlight?.promise === promise) healthFlight = null;
    });
  healthFlight = { epoch, promise };
  return promise;
}

function applySyncStatus(status) {
  if (!status || typeof status !== "object") return;
  lastSync = { ...(lastSync || {}), ...status };
  lastDbHealth = {
    ...(lastDbHealth && typeof lastDbHealth === "object" ? lastDbHealth : { ok: true }),
    fetchFailed: false,
    sync: lastSync,
  };
}

/**
 * One in-flight Turso reconcile. A later call after it settles starts a new POST.
 * @param {{ pull?: boolean, push?: boolean }} [options]
 */
export function reconcileCloud({ pull = true, push = true } = {}) {
  if (syncFlight) return syncFlight;
  healthEpoch += 1;
  let promise;
  promise = apiRunSync({ pull, push })
    .then(async (body) => {
      const result = body && typeof body === "object" ? body : { ok: false };
      if (result.ok === false) return result;
      applySyncStatus(result.status);
      try {
        await refreshOperationalSnapshot();
      } catch {
        /* Keep the snapshot loaded before reconcile. */
      }
      return result;
    })
    .catch(() => ({ ok: false }))
    .finally(() => {
      if (syncFlight === promise) syncFlight = null;
    });
  syncFlight = promise;
  return promise;
}

async function loadSnapshot() {
  if (snapshotFlight && snapshotFlight.epoch === snapshotEpoch) return snapshotFlight.promise;
  const epoch = snapshotEpoch;
  let promise;
  promise = fetch("/api/data/snapshot", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body.data) {
        throw new Error(body.error || "Failed to hydrate from local database");
      }
      if (epoch === snapshotEpoch) {
        hydrateFromSnapshot(body.data);
        setOperationalPrimary(true);
      }
      return { ...body, stale: epoch !== snapshotEpoch };
    })
    .finally(() => {
      if (snapshotFlight?.promise === promise) snapshotFlight = null;
    });
  snapshotFlight = { epoch, promise };
  return promise;
}

/** Explicit snapshot refresh. An older in-flight snapshot cannot overwrite it. */
export function refreshOperationalSnapshot() {
  snapshotEpoch += 1;
  return loadSnapshot();
}

/**
 * Product boot, owned by WorkspaceProviders:
 * 1. One local health read
 * 2. One idempotent localStorage migration check
 * 3. One operational snapshot
 * 4. One non-blocking Turso reconcile, then one follow-up snapshot
 *
 * A second caller joins the in-flight boot. After success, later calls do not
 * repeat migration, snapshot, or reconcile. UI prefs stay in localStorage.
 */
export async function bootstrapDurableStore() {
  if (typeof window === "undefined") return { ok: false, reason: "server" };
  if (durableReady && isOperationalPrimary()) {
    return { ok: true, already: true, health: lastDbHealth, sync: lastSync };
  }
  if (bootFlight) return bootFlight;

  let promise;
  promise = runBootstrap().finally(() => {
    if (bootFlight === promise) bootFlight = null;
  });
  bootFlight = promise;
  return promise;
}

async function runBootstrap() {
  try {
    const health = await fetchDbHealth();
    if (health?.ok === false || health?.fetchFailed || health?.local?.healthy === false) {
      bootError = health?.local?.error || health?.error || "Local database unhealthy";
      return { ok: false, error: bootError, health };
    }

    const dump = collectLocalStorageDump();
    const migrateRes = await fetch("/api/migrate/local-storage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ dump }),
    });
    const migrateBody = await migrateRes.json().catch(() => ({}));
    if (!migrateRes.ok) {
      bootError = migrateBody.error || "Migration failed";
      return { ok: false, error: bootError, migrate: migrateBody };
    }

    try {
      await loadSnapshot();
    } catch (error) {
      bootError = error instanceof Error ? error.message : "Failed to hydrate from local database";
      return { ok: false, error: bootError };
    }

    writeString(MIGRATION_FLAG, "complete_v1");
    durableReady = true;
    const reconcile = reconcileCloud({ pull: true, push: true });

    return {
      ok: true,
      migrate: migrateBody,
      health: lastDbHealth,
      sync: lastSync,
      authority: "sqlite",
      reconcile,
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

/** Debug helper for Settings / tests */
export function getAuthorityLabel() {
  if (isOperationalPrimary()) return "sqlite";
  return "localStorage";
}
