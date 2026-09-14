import { createId, nowIso } from "../../src/data/ids.js";
import { getLocalClient } from "./client.js";

export const JOB_TYPES = {
  SYNC_REMOTE: "SYNC_REMOTE",
  PUBLISH_CONTENT: "PUBLISH_CONTENT",
  REFRESH_ANALYTICS: "REFRESH_ANALYTICS",
  RUN_CAMPAIGN_MONITOR: "RUN_CAMPAIGN_MONITOR",
  RUN_CAMPAIGN_BRAIN: "RUN_CAMPAIGN_BRAIN",
  EVALUATE_EXPERIMENT: "EVALUATE_EXPERIMENT",
  REFRESH_CONNECTION: "REFRESH_CONNECTION",
};

export const JOB_STATES = {
  PENDING: "PENDING",
  RUNNING: "RUNNING",
  DONE: "DONE",
  ERROR: "ERROR",
  FAILED: "FAILED",
};

const LEASE_MS = 30_000;

function clientOr(c) {
  return c || getLocalClient();
}

function backoffSeconds(attemptCount) {
  return Math.min(30 * 2 ** Math.max(0, attemptCount - 1), 3600);
}

function rowToJob(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    payload: JSON.parse(row.payload || "{}"),
    state: row.state,
    createdAt: row.created_at,
    scheduledAt: row.scheduled_at,
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    attemptCount: Number(row.attempt_count || 0),
    lastError: row.last_error || null,
    idempotencyKey: row.idempotency_key || null,
    leaseOwner: row.lease_owner || null,
    leaseUntil: row.lease_until || null,
  };
}

export async function enqueueJob(
  { type, payload = {}, scheduledAt = null, idempotencyKey = null },
  client = null,
) {
  const db = clientOr(client);
  const now = nowIso();
  const id = createId("job");
  const scheduled = scheduledAt || now;

  try {
    await db.execute({
      sql: `INSERT INTO jobs (
        id, type, payload, state, created_at, scheduled_at, started_at, completed_at,
        attempt_count, last_error, idempotency_key, lease_owner, lease_until
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, NULL, ?, NULL, NULL)`,
      args: [
        id,
        type,
        JSON.stringify(payload),
        JOB_STATES.PENDING,
        now,
        scheduled,
        idempotencyKey,
      ],
    });
  } catch (error) {
    if (idempotencyKey && String(error.message || error).includes("UNIQUE")) {
      const existing = await db.execute({
        sql: "SELECT * FROM jobs WHERE idempotency_key = ?",
        args: [idempotencyKey],
      });
      return rowToJob(existing.rows[0]);
    }
    throw error;
  }

  const result = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [id],
  });
  return rowToJob(result.rows[0]);
}

export async function claimNextJob(owner, types = null, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  const nowMs = Date.now();

  let sql = `SELECT * FROM jobs
    WHERE state IN (?, ?)
      AND scheduled_at <= ?
      AND (lease_until IS NULL OR lease_until < ?)
    `;
  const args = [JOB_STATES.PENDING, JOB_STATES.ERROR, now, now];

  if (Array.isArray(types) && types.length) {
    sql += ` AND type IN (${types.map(() => "?").join(",")})`;
    args.push(...types);
  }

  sql += " ORDER BY scheduled_at ASC LIMIT 1";

  const result = await db.execute({ sql, args });
  const row = result.rows[0];
  if (!row) return null;

  const leaseUntil = new Date(nowMs + LEASE_MS).toISOString();
  await db.execute({
    sql: `UPDATE jobs SET state = ?, started_at = ?, lease_owner = ?, lease_until = ?,
      attempt_count = attempt_count + 1 WHERE id = ?`,
    args: [JOB_STATES.RUNNING, now, owner, leaseUntil, row.id],
  });

  const updated = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [row.id],
  });
  return rowToJob(updated.rows[0]);
}

export async function completeJob(id, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  await db.execute({
    sql: `UPDATE jobs SET state = ?, completed_at = ?, lease_owner = NULL, lease_until = NULL, last_error = NULL
      WHERE id = ?`,
    args: [JOB_STATES.DONE, now, id],
  });
}

export async function failJob(id, error, { maxAttempts = 8 } = {}, client = null) {
  const db = clientOr(client);
  const now = nowIso();
  const current = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [id],
  });
  const row = current.rows[0];
  if (!row) return null;

  const attempts = Number(row.attempt_count || 0);
  const message = error?.message || String(error);
  if (attempts >= maxAttempts) {
    await db.execute({
      sql: `UPDATE jobs SET state = ?, last_error = ?, completed_at = ?, lease_owner = NULL, lease_until = NULL
        WHERE id = ?`,
      args: [JOB_STATES.FAILED, message, now, id],
    });
  } else {
    const next = new Date(Date.now() + backoffSeconds(attempts) * 1000).toISOString();
    await db.execute({
      sql: `UPDATE jobs SET state = ?, last_error = ?, scheduled_at = ?, lease_owner = NULL, lease_until = NULL
        WHERE id = ?`,
      args: [JOB_STATES.ERROR, message, next, id],
    });
  }

  const updated = await db.execute({
    sql: "SELECT * FROM jobs WHERE id = ?",
    args: [id],
  });
  return rowToJob(updated.rows[0]);
}

export async function listJobs({ state = null, limit = 100 } = {}, client = null) {
  const db = clientOr(client);
  let sql = "SELECT * FROM jobs";
  const args = [];
  if (state) {
    sql += " WHERE state = ?";
    args.push(state);
  }
  sql += " ORDER BY created_at DESC LIMIT ?";
  args.push(limit);
  const result = await db.execute({ sql, args });
  return result.rows.map(rowToJob);
}
