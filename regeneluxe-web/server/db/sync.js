import { checkLocalHealth, getLocalClient, getRemoteClient, isUnhealthy } from "./client.js";
import { APPEND_ONLY_COLLECTIONS, MUTABLE_COLLECTIONS, COLLECTIONS } from "./collections.js";
import { migrate, SCHEMA_VERSION } from "./migrations.js";
import { claimBatch, markState, OUTBOX_OPS, OUTBOX_STATES } from "./outbox.js";
import { listJobs, JOB_STATES } from "./jobs.js";
import { getMeta, setMeta, get as getLocal, upsert as upsertLocal } from "./repository.js";

let remoteProbeCache = { at: 0, reachable: null, error: null };

export function resetRemoteProbeCache() {
  remoteProbeCache = { at: 0, reachable: null, error: null };
}

async function probeRemoteReachable(remote) {
  const now = Date.now();
  if (remoteProbeCache.reachable != null && now - remoteProbeCache.at < 4000) {
    return remoteProbeCache;
  }
  try {
    await Promise.race([
      remote.execute("SELECT 1"),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Turso probe timed out")), 2500);
      }),
    ]);
    remoteProbeCache = { at: now, reachable: true, error: null };
  } catch (error) {
    remoteProbeCache = {
      at: now,
      reachable: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  return remoteProbeCache;
}

export async function getSyncStatus({ fresh = false } = {}) {
  const remote = getRemoteClient();
  if (!remote) resetRemoteProbeCache();
  if (fresh) resetRemoteProbeCache();
  const health = await checkLocalHealth();
  const unhealthy = isUnhealthy();
  const probe = remote ? await probeRemoteReachable(remote) : { reachable: false, error: null };

  let pendingOutbox = 0;
  let pendingJobs = 0;
  let lastSyncAt = null;
  let syncState = null;

  if (health.ok) {
    try {
      const db = getLocalClient();
      const outbox = await db.execute({
        sql: "SELECT COUNT(*) AS n FROM outbox WHERE state IN (?, ?)",
        args: [OUTBOX_STATES.PENDING, OUTBOX_STATES.SYNCING],
      });
      pendingOutbox = Number(outbox.rows[0]?.n || 0);
      const jobs = await listJobs({ state: JOB_STATES.PENDING }, db);
      const retryJobs = await listJobs({ state: JOB_STATES.ERROR }, db);
      pendingJobs = jobs.length + retryJobs.length;
      lastSyncAt = await getMeta("last_sync_at", db);
      syncState = await getMeta("sync_state", db);
    } catch {
      /* schema may not exist yet */
    }
  }

  let state = "LOCAL_ONLY";
  if (!health.ok || unhealthy) state = "ERROR";
  else if (!remote) state = "LOCAL_ONLY";
  else if (!probe.reachable) state = "OFFLINE";
  else if (pendingOutbox > 0) state = syncState || "PENDING";
  else state = syncState || "SYNCED";

  return {
    cloudConfigured: Boolean(remote),
    cloudReachable: Boolean(remote) && Boolean(probe.reachable),
    state,
    lastSyncAt,
    pendingOutbox,
    pendingJobs,
    localHealthy: Boolean(health.ok) && !unhealthy,
    error: probe.error || unhealthy?.message || health.error || null,
  };
}

async function remoteGetEntity(remote, collection, id) {
  const result = await remote.execute({
    sql: "SELECT * FROM entities WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
  return result.rows[0] || null;
}

async function remoteListCollection(remote, collection) {
  const result = await remote.execute({
    sql: "SELECT * FROM entities WHERE collection = ? AND deleted_at IS NULL",
    args: [collection],
  });
  return result.rows || [];
}

function parseRemoteRow(row) {
  if (!row) return null;
  const payload = JSON.parse(row.payload || "{}");
  return {
    ...payload,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: Number(row.schema_version || SCHEMA_VERSION),
    revision: Number(row.revision || 1),
    syncStatus: row.sync_status || "SYNCED",
    deletedAt: row.deleted_at || null,
  };
}

async function remoteUpsertEntity(remote, item) {
  const now = new Date().toISOString();
  const payload = item.payload == null ? null : JSON.stringify(item.payload);
  await remote.execute({
    sql: `INSERT INTO entities (
      collection, id, payload, created_at, updated_at, schema_version, revision, sync_status, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED', ?)
    ON CONFLICT(collection, id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      schema_version = excluded.schema_version,
      revision = excluded.revision,
      sync_status = 'SYNCED',
      deleted_at = excluded.deleted_at`,
    args: [
      item.collection,
      item.recordId,
      payload,
      item.payload?.createdAt || now,
      item.payload?.updatedAt || now,
      item.payload?.schemaVersion || 1,
      item.revision || 1,
      item.op === OUTBOX_OPS.DELETE ? now : null,
    ],
  });
}

async function remoteSoftDelete(remote, collection, id, revision) {
  const now = new Date().toISOString();
  await remote.execute({
    sql: `UPDATE entities SET deleted_at = ?, updated_at = ?, revision = ?, sync_status = 'SYNCED'
      WHERE collection = ? AND id = ?`,
    args: [now, now, revision || 1, collection, id],
  });
}

/**
 * Push pending outbox entries to remote Turso (if configured).
 * Mutable: CONFLICT when remote.revision > local.
 * Append-only: insert by id; skip if exists.
 */
export async function pushOutboxToRemote() {
  const remote = getRemoteClient();
  if (!remote) {
    return { pushed: 0, skipped: true, reason: "no_remote" };
  }

  await migrate(remote);
  const local = getLocalClient();
  await setMeta("sync_state", "SYNCING", local);

  const batch = await claimBatch({ limit: 50 }, local);
  let pushed = 0;
  let conflicts = 0;
  let errors = 0;

  for (const item of batch) {
    try {
      const remoteRow = await remoteGetEntity(remote, item.collection, item.recordId);
      const appendOnly =
        APPEND_ONLY_COLLECTIONS.has(item.collection) || item.collection === "metric_snapshots";
      const mutable = MUTABLE_COLLECTIONS.has(item.collection);

      if (item.op === OUTBOX_OPS.DELETE) {
        if (remoteRow) {
          await remoteSoftDelete(remote, item.collection, item.recordId, item.revision);
        }
        await markState(item.id, OUTBOX_STATES.DONE, {}, local);
        await local.execute({
          sql: "UPDATE entities SET sync_status = 'SYNCED' WHERE collection = ? AND id = ?",
          args: [item.collection, item.recordId],
        });
        pushed += 1;
        continue;
      }

      if (appendOnly) {
        if (remoteRow) {
          await markState(item.id, OUTBOX_STATES.DONE, {}, local);
          pushed += 1;
          continue;
        }
        await remoteUpsertEntity(remote, item);
        await markState(item.id, OUTBOX_STATES.DONE, {}, local);
        await local.execute({
          sql: "UPDATE entities SET sync_status = 'SYNCED' WHERE collection = ? AND id = ?",
          args: [item.collection, item.recordId],
        });
        pushed += 1;
        continue;
      }

      if (mutable && remoteRow && Number(remoteRow.revision) > Number(item.revision || 0)) {
        await markState(item.id, OUTBOX_STATES.CONFLICT, {
          lastError: `remote revision ${remoteRow.revision} > local ${item.revision}`,
        }, local);
        await local.execute({
          sql: "UPDATE entities SET sync_status = 'CONFLICT' WHERE collection = ? AND id = ?",
          args: [item.collection, item.recordId],
        });
        conflicts += 1;
        continue;
      }

      await remoteUpsertEntity(remote, item);
      await markState(item.id, OUTBOX_STATES.DONE, {}, local);
      await local.execute({
        sql: "UPDATE entities SET sync_status = 'SYNCED' WHERE collection = ? AND id = ?",
        args: [item.collection, item.recordId],
      });
      pushed += 1;
    } catch (error) {
      errors += 1;
      await markState(
        item.id,
        OUTBOX_STATES.ERROR,
        {
          lastError: error?.message || String(error),
          nextAttemptAt: new Date(Date.now() + 60_000).toISOString(),
        },
        local,
      );
    }
  }

  const now = new Date().toISOString();
  await setMeta("last_sync_at", now, local);
  await setMeta("sync_state", conflicts ? "CONFLICT" : errors ? "ERROR" : "SYNCED", local);

  return { pushed, conflicts, errors, skipped: false };
}

/**
 * Pull remote Turso entities into local SQLite without blind overwrite.
 *
 * Append-only: insert missing by stable id; never replace existing.
 * Mutable: higher revision wins; local-newer stays local (pending push).
 */
export async function pullRemoteToLocal() {
  const remote = getRemoteClient();
  if (!remote) {
    return { pulled: 0, skipped: true, reason: "no_remote" };
  }

  await migrate(remote);
  const local = getLocalClient();
  await setMeta("sync_state", "SYNCING", local);

  let pulled = 0;
  let skippedCount = 0;
  let conflicts = 0;
  const collections = Object.values(COLLECTIONS);

  for (const collection of collections) {
    const remoteRows = await remoteListCollection(remote, collection);
    for (const row of remoteRows) {
      const remoteRecord = parseRemoteRow(row);
      if (!remoteRecord?.id) continue;
      const localRecord = await getLocal(collection, remoteRecord.id, local);
      const appendOnly = APPEND_ONLY_COLLECTIONS.has(collection) || collection === "metric_snapshots";
      const mutable = MUTABLE_COLLECTIONS.has(collection);

      if (appendOnly) {
        if (localRecord) {
          skippedCount += 1;
          continue;
        }
        await upsertLocal(collection, remoteRecord, local, {
          skipOutbox: true,
          forceRevision: remoteRecord.revision || 1,
        });
        pulled += 1;
        continue;
      }

      if (!localRecord) {
        await upsertLocal(collection, remoteRecord, local, {
          skipOutbox: true,
          forceRevision: remoteRecord.revision || 1,
        });
        pulled += 1;
        continue;
      }

      const localRev = Number(localRecord.revision || 0);
      const remoteRev = Number(remoteRecord.revision || 0);

      if (remoteRev > localRev) {
        await upsertLocal(collection, remoteRecord, local, {
          skipOutbox: true,
          forceRevision: remoteRev,
        });
        pulled += 1;
      } else if (remoteRev < localRev && mutable) {
        skippedCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    const deletedRemote = await remote.execute({
      sql: "SELECT * FROM entities WHERE collection = ? AND deleted_at IS NOT NULL",
      args: [collection],
    });
    for (const row of deletedRemote.rows || []) {
      const localRecord = await getLocal(collection, row.id, local);
      if (!localRecord || localRecord.deletedAt) continue;
      if (Number(row.revision || 0) >= Number(localRecord.revision || 0)) {
        await local.execute({
          sql: `UPDATE entities SET deleted_at = ?, updated_at = ?, revision = ?, sync_status = 'SYNCED'
            WHERE collection = ? AND id = ?`,
          args: [row.deleted_at, row.updated_at || new Date().toISOString(), row.revision || 1, collection, row.id],
        });
        pulled += 1;
      } else {
        conflicts += 1;
      }
    }
  }

  const now = new Date().toISOString();
  await setMeta("last_sync_at", now, local);
  await setMeta("sync_state", conflicts ? "CONFLICT" : "SYNCED", local);

  return { pulled, skipped: skippedCount, conflicts, reason: null };
}

export async function reconcileWithRemote() {
  const pull = await pullRemoteToLocal();
  const push = await pushOutboxToRemote();
  return { pull, push };
}
