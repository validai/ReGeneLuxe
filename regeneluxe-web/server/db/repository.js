import { nowIso } from "../../src/data/ids.js";
import { getLocalClient } from "./client.js";
import { SCHEMA_VERSION } from "./migrations.js";
import { enqueue as enqueueOutbox, OUTBOX_OPS } from "./outbox.js";

function clientOr(c) {
  return c || getLocalClient();
}

function parseRow(row) {
  if (!row) return null;
  const payload = JSON.parse(row.payload);
  return {
    ...payload,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    schemaVersion: Number(row.schema_version),
    revision: Number(row.revision),
    syncStatus: row.sync_status,
    deletedAt: row.deleted_at || null,
  };
}

function isAnalyticsCollection(collection) {
  return collection === "analytics" || collection === "metric_snapshots";
}

async function writeMetricSnapshot(db, record, meta) {
  const id = record.id;
  const existing = await db.execute({
    sql: "SELECT id FROM metric_snapshots WHERE id = ?",
    args: [id],
  });
  const payload = JSON.stringify(record);
  if (existing.rows.length) {
    await db.execute({
      sql: `UPDATE metric_snapshots SET
        campaign_id = ?, account_id = ?, content_id = ?, provider = ?,
        captured_at = ?, provider_updated_at = ?, source = ?, payload = ?,
        updated_at = ?, revision = ?, sync_status = ?, deleted_at = ?
        WHERE id = ?`,
      args: [
        record.campaignId || null,
        record.accountId || null,
        record.contentId || null,
        record.provider || null,
        record.capturedAt || meta.updatedAt,
        record.providerUpdatedAt || null,
        record.source || null,
        payload,
        meta.updatedAt,
        meta.revision,
        meta.syncStatus,
        meta.deletedAt,
        id,
      ],
    });
  } else {
    await db.execute({
      sql: `INSERT INTO metric_snapshots (
        id, campaign_id, account_id, content_id, provider, captured_at,
        provider_updated_at, source, payload, created_at, updated_at,
        revision, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        id,
        record.campaignId || null,
        record.accountId || null,
        record.contentId || null,
        record.provider || null,
        record.capturedAt || meta.createdAt,
        record.providerUpdatedAt || null,
        record.source || null,
        payload,
        meta.createdAt,
        meta.updatedAt,
        meta.revision,
        meta.syncStatus,
        meta.deletedAt,
      ],
    });
  }
}

export async function list(collection, { includeDeleted = false } = {}, client = null) {
  const db = clientOr(client);
  const sql = includeDeleted
    ? "SELECT * FROM entities WHERE collection = ? ORDER BY updated_at DESC"
    : "SELECT * FROM entities WHERE collection = ? AND deleted_at IS NULL ORDER BY updated_at DESC";
  const result = await db.execute({ sql, args: [collection] });
  return result.rows.map(parseRow);
}

export async function get(collection, id, client = null) {
  const db = clientOr(client);
  const result = await db.execute({
    sql: "SELECT * FROM entities WHERE collection = ? AND id = ?",
    args: [collection, id],
  });
  return parseRow(result.rows[0]);
}

export async function upsert(collection, record, client = null) {
  if (!record || !record.id) {
    throw new Error("upsert requires record.id");
  }
  const db = clientOr(client);
  const existing = await get(collection, record.id, db);
  const now = nowIso();
  const createdAt = existing?.createdAt || record.createdAt || now;
  const revision = (existing?.revision || 0) + 1;
  const payload = {
    ...record,
    id: record.id,
    createdAt,
    updatedAt: now,
  };
  delete payload.revision;
  delete payload.syncStatus;
  delete payload.deletedAt;
  delete payload.schemaVersion;

  await db.execute({
    sql: `INSERT INTO entities (
      collection, id, payload, created_at, updated_at, schema_version, revision, sync_status, deleted_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', NULL)
    ON CONFLICT(collection, id) DO UPDATE SET
      payload = excluded.payload,
      updated_at = excluded.updated_at,
      schema_version = excluded.schema_version,
      revision = excluded.revision,
      sync_status = 'PENDING',
      deleted_at = NULL`,
    args: [
      collection,
      record.id,
      JSON.stringify(payload),
      createdAt,
      now,
      SCHEMA_VERSION,
      revision,
    ],
  });

  if (isAnalyticsCollection(collection)) {
    await writeMetricSnapshot(db, payload, {
      createdAt,
      updatedAt: now,
      revision,
      syncStatus: "PENDING",
      deletedAt: null,
    });
  }

  await enqueueOutbox(
    {
      collection,
      recordId: record.id,
      op: OUTBOX_OPS.UPSERT,
      payload,
      revision,
      idempotencyKey: `${collection}:${record.id}:${revision}`,
    },
    db,
  );

  return get(collection, record.id, db);
}

export async function remove(collection, id, client = null) {
  const db = clientOr(client);
  const existing = await get(collection, id, db);
  if (!existing) return null;

  const now = nowIso();
  const revision = (existing.revision || 0) + 1;

  await db.execute({
    sql: `UPDATE entities SET deleted_at = ?, updated_at = ?, revision = ?, sync_status = 'PENDING'
      WHERE collection = ? AND id = ?`,
    args: [now, now, revision, collection, id],
  });

  if (isAnalyticsCollection(collection)) {
    await db.execute({
      sql: `UPDATE metric_snapshots SET deleted_at = ?, updated_at = ?, revision = ?, sync_status = 'PENDING'
        WHERE id = ?`,
      args: [now, now, revision, id],
    });
  }

  await enqueueOutbox(
    {
      collection,
      recordId: id,
      op: OUTBOX_OPS.DELETE,
      payload: null,
      revision,
      idempotencyKey: `${collection}:${id}:${revision}`,
    },
    db,
  );

  return get(collection, id, db);
}

export async function replaceAll(collection, records, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  await db.execute({
    sql: "DELETE FROM entities WHERE collection = ?",
    args: [collection],
  });
  if (isAnalyticsCollection(collection)) {
    await db.execute("DELETE FROM metric_snapshots");
  }

  const list = Array.isArray(records) ? records : [];
  for (const record of list) {
    if (!record?.id) continue;
    const createdAt = record.createdAt || now;
    const updatedAt = record.updatedAt || createdAt;
    const payload = { ...record, id: record.id, createdAt, updatedAt };
    delete payload.revision;
    delete payload.syncStatus;
    delete payload.deletedAt;
    delete payload.schemaVersion;

    await db.execute({
      sql: `INSERT INTO entities (
        collection, id, payload, created_at, updated_at, schema_version, revision, sync_status, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, 1, 'PENDING', NULL)`,
      args: [
        collection,
        record.id,
        JSON.stringify(payload),
        createdAt,
        updatedAt,
        SCHEMA_VERSION,
      ],
    });

    if (isAnalyticsCollection(collection)) {
      await writeMetricSnapshot(db, payload, {
        createdAt,
        updatedAt,
        revision: 1,
        syncStatus: "PENDING",
        deletedAt: null,
      });
    }
  }
  return list.length;
}

export async function count(collection, { includeDeleted = false } = {}, client = null) {
  const db = clientOr(client);
  const sql = includeDeleted
    ? "SELECT COUNT(*) AS n FROM entities WHERE collection = ?"
    : "SELECT COUNT(*) AS n FROM entities WHERE collection = ? AND deleted_at IS NULL";
  const result = await db.execute({ sql, args: [collection] });
  return Number(result.rows[0]?.n || 0);
}

export async function getMeta(key, client = null) {
  const db = clientOr(client);
  const result = await db.execute({
    sql: "SELECT value FROM meta WHERE key = ?",
    args: [key],
  });
  return result.rows[0]?.value ?? null;
}

export async function setMeta(key, value, client = null) {
  const db = clientOr(client);
  await db.execute({
    sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [key, String(value)],
  });
}
