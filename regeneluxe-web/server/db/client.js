import { createClient } from "@libsql/client";
import { existsSync, renameSync } from "node:fs";
import { join } from "node:path";
import { dbPath, ensureDirs, quarantineDir } from "./paths.js";

let localClient = null;
let remoteClient = null;
let localOverride = null;
let remoteOverride = null;
let unhealthy = null;

export function isMemoryMode() {
  if (process.env.RL_DB_MODE === "memory") return true;
  if (process.env.RL_DB_MODE === "file") return false;
  if (process.env.NODE_ENV === "test") return true;
  if (process.env.VITEST) return true;
  return false;
}

export function isUnhealthy() {
  return unhealthy;
}

export function clearUnhealthy() {
  unhealthy = null;
}

function markUnhealthy(error) {
  unhealthy = {
    at: new Date().toISOString(),
    message: error?.message || String(error),
  };
  return unhealthy;
}

/**
 * Quarantine a corrupt on-disk DB. Never deletes/recreates silently.
 * @returns {string} path of quarantined file
 */
export function quarantineLocalDb(reason = "corrupt") {
  ensureDirs();
  const path = dbPath();
  if (!existsSync(path)) {
    throw new Error(`Cannot quarantine missing DB at ${path}`);
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dest = join(quarantineDir(), `local_${stamp}_${reason}.db`);
  renameSync(path, dest);
  markUnhealthy(new Error(`Local DB quarantined to ${dest}: ${reason}`));
  return dest;
}

async function probeClient(client) {
  await client.execute("SELECT 1");
}

function createLocalClient() {
  if (isMemoryMode()) {
    return createClient({ url: ":memory:" });
  }
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    throw new Error("Automated tests must use an isolated SQLite database, never .regeneluxe/local.db");
  }
  ensureDirs();
  const path = dbPath();
  return createClient({ url: `file:${path}` });
}

export function getLocalClient() {
  if (localOverride) return localOverride;
  if (unhealthy && !isMemoryMode()) {
    throw new Error(`Local DB unhealthy: ${unhealthy.message}`);
  }
  if (!localClient) {
    localClient = createLocalClient();
  }
  return localClient;
}

export function getRemoteClient() {
  if (remoteOverride) return remoteOverride;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url || !authToken) return null;
  if (!remoteClient) {
    remoteClient = createClient({ url, authToken });
  }
  return remoteClient;
}

/** Point sync at isolated clients. Refuses to run outside Vitest. */
export function setTestClients({ local, remote } = {}) {
  if (!process.env.VITEST && process.env.NODE_ENV !== "test") {
    throw new Error("setTestClients is only allowed in test mode");
  }
  if (local !== undefined) {
    localOverride = local;
    localClient = local;
  }
  if (remote !== undefined) {
    remoteOverride = remote;
    remoteClient = remote;
  }
}

export async function closeDb() {
  const unique = [...new Set([localClient, remoteClient].filter(Boolean))];
  localClient = null;
  remoteClient = null;
  localOverride = null;
  remoteOverride = null;
  for (const client of unique) {
    try {
      client.close();
    } catch {
      /* ignore */
    }
  }
}

/** Reset in-memory client only (tests). */
export async function resetDbForTests() {
  if (!isMemoryMode()) {
    throw new Error("resetDbForTests is only allowed in memory mode");
  }
  localOverride = null;
  remoteOverride = null;
  await closeDb();
  clearUnhealthy();
  localClient = createLocalClient();
  return localClient;
}

export async function checkLocalHealth() {
  try {
    const client = getLocalClient();
    await probeClient(client);
    return { ok: true, mode: isMemoryMode() ? "memory" : "file" };
  } catch (error) {
    if (!isMemoryMode() && existsSync(dbPath())) {
      try {
        quarantineLocalDb("health_check_failed");
      } catch (qErr) {
        markUnhealthy(qErr);
      }
    } else {
      markUnhealthy(error);
    }
    return {
      ok: false,
      mode: isMemoryMode() ? "memory" : "file",
      error: unhealthy?.message || error.message,
      unhealthy,
    };
  }
}
