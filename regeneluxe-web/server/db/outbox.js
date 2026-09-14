import { createId, nowIso } from "../../src/data/ids.js";
import { getLocalClient } from "./client.js";

export const OUTBOX_STATES = {
  PENDING: "PENDING",
  SYNCING: "SYNCING",
  DONE: "DONE",
  ERROR: "ERROR",
  CONFLICT: "CONFLICT",
};

export const OUTBOX_OPS = {
  UPSERT: "UPSERT",
  DELETE: "DELETE",
};

function clientOr(c) {
  return c || getLocalClient();
}

export async function enqueue(
  {
    collection,
    recordId,
    op,
    payload = null,
    revision = null,
    idempotencyKey = null,
  },
  client = null,
) {
  const db = clientOr(client);
  const now = nowIso();
  const id = createId("outbox");
  const key = idempotencyKey || `${collection}:${recordId}:${revision || 0}:${op}`;

  try {
    await db.execute({
      sql: `INSERT INTO outbox (
        id, collection, record_id, op, payload, revision, idempotency_key,
        created_at, updated_at, state, attempts, last_error, next_attempt_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, NULL)`,
      args: [
        id,
        collection,
        recordId,
        op,
        payload == null ? null : JSON.stringify(payload),
        revision,
        key,
        now,
        now,
        OUTBOX_STATES.PENDING,
      ],
    });
  } catch (error) {
    if (String(error.message || error).includes("UNIQUE")) {
      const existing = await db.execute({
        sql: "SELECT * FROM outbox WHERE idempotency_key = ?",
        args: [key],
      });
      return rowToOutbox(existing.rows[0]);
    }
    throw error;
  }

  const result = await db.execute({
    sql: "SELECT * FROM outbox WHERE id = ?",
    args: [id],
  });
  return rowToOutbox(result.rows[0]);
}

export async function listPending({ limit = 100 } = {}, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  const result = await db.execute({
    sql: `SELECT * FROM outbox
      WHERE state = ?
        AND (next_attempt_at IS NULL OR next_attempt_at <= ?)
      ORDER BY created_at ASC
      LIMIT ?`,
    args: [OUTBOX_STATES.PENDING, now, limit],
  });
  return result.rows.map(rowToOutbox);
}

export async function markState(id, state, { lastError = null, nextAttemptAt = null } = {}, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  await db.execute({
    sql: `UPDATE outbox SET state = ?, updated_at = ?, last_error = ?, next_attempt_at = ?,
      attempts = CASE WHEN ? IN ('ERROR', 'SYNCING') THEN attempts + 1 ELSE attempts END
      WHERE id = ?`,
    args: [state, now, lastError, nextAttemptAt, state, id],
  });
}

export async function claimBatch({ limit = 50 } = {}, client = null) {
  const pending = await listPending({ limit }, client);
  const claimed = [];
  for (const item of pending) {
    await markState(item.id, OUTBOX_STATES.SYNCING, {}, client);
    claimed.push({ ...item, state: OUTBOX_STATES.SYNCING });
  }
  return claimed;
}

function rowToOutbox(row) {
  if (!row) return null;
  return {
    id: row.id,
    collection: row.collection,
    recordId: row.record_id,
    op: row.op,
    payload: row.payload ? JSON.parse(row.payload) : null,
    revision: row.revision == null ? null : Number(row.revision),
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    state: row.state,
    attempts: Number(row.attempts || 0),
    lastError: row.last_error || null,
    nextAttemptAt: row.next_attempt_at || null,
  };
}
