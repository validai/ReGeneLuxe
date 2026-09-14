/** DB schema version (SQLite). Distinct from localStorage SCHEMA_VERSION (4). */
export const SCHEMA_VERSION = 1;

const MIGRATIONS = [
  {
    version: 1,
    name: "initial",
    sql: `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entities (
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  schema_version INTEGER NOT NULL DEFAULT 1,
  revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  deleted_at TEXT,
  PRIMARY KEY (collection, id)
);

CREATE INDEX IF NOT EXISTS idx_entities_collection_updated
  ON entities (collection, updated_at);
CREATE INDEX IF NOT EXISTS idx_entities_collection_sync
  ON entities (collection, sync_status);
CREATE INDEX IF NOT EXISTS idx_entities_sync
  ON entities (sync_status);

CREATE TABLE IF NOT EXISTS outbox (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  op TEXT NOT NULL,
  payload TEXT,
  revision INTEGER,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  state TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  idempotency_key TEXT UNIQUE,
  lease_owner TEXT,
  lease_until TEXT
);

CREATE TABLE IF NOT EXISTS metric_snapshots (
  id TEXT PRIMARY KEY,
  campaign_id TEXT,
  account_id TEXT,
  content_id TEXT,
  provider TEXT,
  captured_at TEXT NOT NULL,
  provider_updated_at TEXT,
  source TEXT,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  sync_status TEXT NOT NULL DEFAULT 'PENDING',
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_metric_campaign_captured
  ON metric_snapshots (campaign_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_metric_account_captured
  ON metric_snapshots (account_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_metric_content_captured
  ON metric_snapshots (content_id, captured_at);
CREATE INDEX IF NOT EXISTS idx_metric_provider_captured
  ON metric_snapshots (provider, captured_at);
`,
  },
];

export async function getAppliedVersions(client) {
  try {
    const result = await client.execute(
      "SELECT version FROM schema_migrations ORDER BY version",
    );
    return result.rows.map((row) => Number(row.version));
  } catch {
    return [];
  }
}

export async function migrate(client) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);

  const applied = new Set(await getAppliedVersions(client));
  const now = new Date().toISOString();
  const newlyApplied = [];

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    await client.executeMultiple(migration.sql);
    await client.execute({
      sql: "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      args: [migration.version, migration.name, now],
    });
    await client.execute({
      sql: "INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      args: ["schema_version", String(SCHEMA_VERSION)],
    });
    newlyApplied.push(migration.version);
  }

  return { schemaVersion: SCHEMA_VERSION, applied: newlyApplied };
}
