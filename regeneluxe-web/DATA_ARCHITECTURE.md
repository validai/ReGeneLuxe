# Data Architecture Decision — ReGeneLuxe

## Selected stack

| Layer | Choice |
|-------|--------|
| Local durable store | **SQLite via `@libsql/client` (`file:.regeneluxe/local.db`)** |
| Remote / cloud copy | **Turso Cloud (optional)** via `@libsql/client` HTTP when `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` are set |
| Sync | **Application outbox + controlled push/pull** — not Embedded Replicas auto-write, not blind LWW |
| Secrets | `server/.secrets.json` / env — **never** in synced app tables |
| UI access | Client memory mirror + same-origin `/api/*` — **no SQLite in React** |

## Turso evaluation (2026)

| Feature | Maturity / fit | Decision |
|---------|----------------|----------|
| Turso Cloud remote SQLite | Production-ready; strong TypeScript story | **Use as remote target** |
| `@libsql/client` file: local | Production-ready libSQL/SQLite | **Use for local DB** |
| Embedded Replicas | Production, but **writes default to cloud primary** — not local-first | **Reject as primary model** |
| `@tursodatabase/sync` | Recommended for new sync; newer engine rewrite; conflict policy still app concern | **Do not depend on as sole sync/idempotency layer yet** |
| Offline writes via Sync magic | Insufficient alone for publish idempotency / job leases | **App outbox + jobs required regardless** |

## Why not Supabase/Postgres

Turso/SQLite aligns with local-first, future desktop/mobile clients, and a single SQL dialect. No material Turso Cloud blocker for a **controlled** remote copy. Dual SQLite+Postgres writes without a sync model are forbidden.

## Sync semantics (summary)

- Local edit always succeeds against local SQLite (via API).
- Outbox records `UPSERT` / `DELETE` intents for remote.
- Sync states: `LOCAL_ONLY` | `PENDING` | `SYNCING` | `SYNCED` | `ERROR` | `CONFLICT`
- Conflict policy by type (see sprint 111): append-only for analytics/decisions/attempts; revision checks for mutable campaigns/content.
- Cloud unavailable → app stays usable; Settings shows “Cloud sync pending”.

## DB failure policy

- Never silently delete/recreate a corrupt local DB.
- Mark unhealthy, surface in Settings, keep quarantine path under `.regeneluxe/`.
