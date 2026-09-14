import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLocalClient } from "./client.js";
import { SCHEMA_VERSION } from "./migrations.js";
import { backupsDir, ensureDirs } from "./paths.js";
import { list, replaceAll, setMeta } from "./repository.js";
import { COLLECTIONS } from "./collections.js";

const SECRET_KEYS = ["apiKey", "accessToken", "refreshToken", "token", "secret", "password"];

function stripSecrets(value) {
  if (!value || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(stripSecrets);
  const clone = { ...value };
  for (const key of SECRET_KEYS) {
    delete clone[key];
  }
  for (const key of Object.keys(clone)) {
    clone[key] = stripSecrets(clone[key]);
  }
  return clone;
}

const EXPORT_COLLECTIONS = Object.values(COLLECTIONS);

/**
 * Export a strip-secrets snapshot of all entity collections.
 */
export async function exportDatabaseSnapshot() {
  const db = getLocalClient();
  const collections = {};
  for (const name of EXPORT_COLLECTIONS) {
    collections[name] = await list(name, { includeDeleted: true }, db);
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
 * Secrets are stripped from the import payload.
 */
export async function importDatabaseSnapshot(data) {
  if (!data || typeof data !== "object" || data.kind !== "sqlite-snapshot") {
    return { ok: false, error: "Invalid sqlite-snapshot payload" };
  }

  const cleaned = stripSecrets(data);
  ensureDirs();

  const current = await exportDatabaseSnapshot();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupsDir(), `pre_import_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(current, null, 2));

  const db = getLocalClient();
  const collections = cleaned.collections || {};

  try {
    await db.execute("BEGIN");
    for (const name of EXPORT_COLLECTIONS) {
      const records = Array.isArray(collections[name]) ? collections[name] : [];
      await replaceAll(name, records, db);
    }
    if (Array.isArray(cleaned.meta)) {
      for (const entry of cleaned.meta) {
        if (!entry?.key) continue;
        await setMeta(entry.key, entry.value, db);
      }
    }
    await setMeta("last_import_at", new Date().toISOString(), db);
    await db.execute("COMMIT");
  } catch (error) {
    try {
      await db.execute("ROLLBACK");
    } catch {
      /* ignore */
    }
    return { ok: false, error: error?.message || String(error), backupPath };
  }

  return { ok: true, backupPath };
}
