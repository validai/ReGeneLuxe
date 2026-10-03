import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLocalClient } from "./client.js";
import { SCHEMA_VERSION } from "./migrations.js";
import { backupsDir, ensureDirs } from "./paths.js";
import { list, replaceAll, setMeta } from "./repository.js";
import { COLLECTIONS } from "./collections.js";
import { stripSecretFields } from "../../src/data/secretFields.js";
import { applyRemoteRecord, lockIdentityFields } from "../auth/identityLock.js";

function stripSecrets(value) {
  return stripSecretFields(value);
}

const EXPORT_COLLECTIONS = Object.values(COLLECTIONS);
const CLIENT_EXCLUDED = new Set([COLLECTIONS.gmail_messages]);

/**
 * Export a strip-secrets snapshot of entity collections.
 * Gmail message rows and vault secrets are never included.
 */
export async function exportDatabaseSnapshot({ workspaceId = null, operatorId = null } = {}) {
  const db = getLocalClient();
  const collections = {};
  for (const name of EXPORT_COLLECTIONS) {
    if (CLIENT_EXCLUDED.has(name)) {
      collections[name] = [];
      continue;
    }
    const rows = await list(name, { includeDeleted: true }, db);
    if (workspaceId && name !== COLLECTIONS.settings && name !== COLLECTIONS.ui_prefs) {
      collections[name] = rows.filter((row) => {
        if (name === COLLECTIONS.operators) return !operatorId || row.id === operatorId;
        if (name === COLLECTIONS.managed_profiles) return row.id === workspaceId;
        if (!row?.managedProfileId) return true;
        return row.managedProfileId === workspaceId;
      });
    } else {
      collections[name] = rows;
    }
  }

  let metaRows = [];
  try {
    const result = await db.execute("SELECT key, value FROM meta");
    metaRows = result.rows.map((row) => ({ key: row.key, value: row.value }));
  } catch {
    metaRows = [];
  }

  return stripSecrets({
    app: "ReGeneLuxe",
    kind: "sqlite-snapshot",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    collections,
    meta: metaRows,
  });
}

/**
 * Import a snapshot transactionally. Writes a pre-import backup first.
 * Secrets are stripped. Identity fields on existing records stay locked.
 */
export async function importDatabaseSnapshot(data, { workspaceId = null, operatorId = null } = {}) {
  if (!data || typeof data !== "object" || data.kind !== "sqlite-snapshot") {
    return { ok: false, error: "Invalid sqlite-snapshot payload" };
  }

  const cleaned = stripSecrets(data);
  ensureDirs();

  const current = await exportDatabaseSnapshot({ workspaceId, operatorId });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupsDir(), `pre_import_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(current, null, 2));

  const db = getLocalClient();
  const collections = cleaned.collections || {};

  try {
    await db.execute("BEGIN");
    for (const name of EXPORT_COLLECTIONS) {
      if (CLIENT_EXCLUDED.has(name)) continue;
      const records = Array.isArray(collections[name]) ? collections[name] : [];
      if (name === COLLECTIONS.operators) {
        const existing = await list(name, { includeDeleted: true }, db);
        const merged = existing.map((row) => applyRemoteRecord(name, row, records.find((item) => item.id === row.id) || row));
        await replaceAll(name, merged, db);
        continue;
      }
      if (workspaceId) {
        const existing = await list(name, { includeDeleted: true }, db);
        const others = existing.filter((row) => row?.managedProfileId && row.managedProfileId !== workspaceId);
        if (name === COLLECTIONS.managed_profiles) {
          const local = existing.find((row) => row.id === workspaceId);
          const incoming = records.find((row) => row.id === workspaceId);
          const next = local
            ? applyRemoteRecord(name, local, incoming || local)
            : incoming;
          await replaceAll(name, [...existing.filter((row) => row.id !== workspaceId), next].filter(Boolean), db);
          continue;
        }
        const stamped = records.map((row) => {
          const existingRow = existing.find((item) => item.id === row.id) || null;
          const locked = lockIdentityFields(row, existingRow);
          return {
            ...locked,
            managedProfileId: existingRow?.managedProfileId || workspaceId,
            ownerOperatorId: existingRow?.ownerOperatorId || operatorId || locked.ownerOperatorId,
          };
        });
        await replaceAll(name, [...others, ...stamped], db);
        continue;
      }
      await replaceAll(name, records, db);
    }
    if (Array.isArray(cleaned.meta)) {
      for (const entry of cleaned.meta) {
        if (!entry?.key) continue;
        if (/token|secret|auth|google|turso|key/i.test(String(entry.key))) continue;
        await setMeta(entry.key, entry.value, db);
      }
    }
    await setMeta("last_import_at", new Date().toISOString(), db);
    await db.execute("COMMIT");
  } catch {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: "Could not import backup." };
  }

  return { ok: true };
}
