import { checkLocalHealth, getLocalClient, getRemoteClient, isUnhealthy } from "./client.js";
import { APPEND_ONLY_COLLECTIONS, MUTABLE_COLLECTIONS } from "./collections.js";
import { migrate } from "./migrations.js";
import { claimBatch, markState, OUTBOX_OPS, OUTBOX_STATES } from "./outbox.js";
import { listJobs, JOB_STATES } from "./jobs.js";
import { getMeta, setMeta } from "./repository.js";

export async function getSyncStatus() {
  const remote = getRemoteClient();
  const health = await checkLocalHealth();
  const unhealthy = isUnhealthy();

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
  else if (pendingOutbox > 0) state = syncState || "PENDING";
  else state = syncState || "SYNCED";

  return {
    cloudConfigured: Boolean(remote),
    state,
    lastSyncAt,
    pendingOutbox,
    pendingJobs,
    localHealthy: Boolean(health.ok) && !unhealthy,
    error: unhealthy?.message || health.error || null,
  };
}

async function remoteGetEntity(remote, collection, id) {
  const result = await remote.execute({
    sql: "SELECT * FROM entities WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
  return result.rows[0] || null;
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
 * Mutable collections: CONFLICT when remote.revision > local.
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
