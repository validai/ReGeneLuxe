import { ensureDirs } from "./paths.js";
import {
  checkLocalHealth,
  closeDb,
  getLocalClient,
  getRemoteClient,
  isMemoryMode,
  quarantineLocalDb,
  resetDbForTests,
} from "./client.js";
import { migrate, SCHEMA_VERSION } from "./migrations.js";
import * as repository from "./repository.js";
import * as outbox from "./outbox.js";
import * as jobs from "./jobs.js";
import * as sync from "./sync.js";
import { migrateLocalStorageDump } from "./migrateLocalStorage.js";
import { exportDatabaseSnapshot, importDatabaseSnapshot } from "./backup.js";
import { COLLECTIONS, MUTABLE_COLLECTIONS, APPEND_ONLY_COLLECTIONS } from "./collections.js";

export {
  SCHEMA_VERSION,
  COLLECTIONS,
  MUTABLE_COLLECTIONS,
  APPEND_ONLY_COLLECTIONS,
  ensureDirs,
  getLocalClient,
  getRemoteClient,
  closeDb,
  resetDbForTests,
  isMemoryMode,
  quarantineLocalDb,
  migrate,
  migrateLocalStorageDump,
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  repository,
  outbox,
  jobs,
  sync,
};

export async function initDb() {
  if (!isMemoryMode()) ensureDirs();
  const client = getLocalClient();
  const result = await migrate(client);
  return { ok: true, ...result };
}

export async function getDbHealth() {
  const health = await checkLocalHealth();
  const syncStatus = await sync.getSyncStatus({ fresh: true }).catch((error) => ({
    cloudConfigured: Boolean(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN),
    cloudReachable: false,
    state: process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN ? "OFFLINE" : "ERROR",
    lastSyncAt: null,
    pendingOutbox: 0,
    pendingJobs: 0,
    localHealthy: false,
    error: error?.message || String(error),
  }));
  return {
    ...health,
    schemaVersion: SCHEMA_VERSION,
    sync: syncStatus,
  };
}

export const list = repository.list;
export const get = repository.get;
export const upsert = repository.upsert;
export const remove = repository.remove;
export const replaceAll = repository.replaceAll;
export const count = repository.count;
export const getMeta = repository.getMeta;
export const setMeta = repository.setMeta;

export const getSyncStatus = sync.getSyncStatus;
export const pushOutboxToRemote = sync.pushOutboxToRemote;
export const pullRemoteToLocal = sync.pullRemoteToLocal;
export const reconcileWithRemote = sync.reconcileWithRemote;

export const enqueueJob = jobs.enqueueJob;
export const claimNextJob = jobs.claimNextJob;
export const completeJob = jobs.completeJob;
export const failJob = jobs.failJob;
export const listJobs = jobs.listJobs;
export const JOB_TYPES = jobs.JOB_TYPES;
