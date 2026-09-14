# Data Migration Plan — ReGeneLuxe (Sprints 105–120)

## Current state (forensic)

**Primary store:** browser `localStorage` (`DATA_BACKEND = "localStorage"`).  
**Secrets:** `server/.secrets.json` (never sync to cloud app tables).  
**Schema version marker:** `rl_schema_version` = `4`.

### localStorage keys

| Key | Class | Notes |
|-----|-------|-------|
| `rl_campaigns_v1` | DURABLE | Campaigns + nested intake/blueprint/assets/results |
| `rl_accounts_v1` | DURABLE | Social accounts (no secrets) |
| `rl_settings_v1` | DURABLE | Theme, AI mode, defaults |
| `rl_content_v1` | DURABLE | Content library |
| `rl_inbox_v1` | DURABLE | Interactions |
| `rl_analytics_v1` | DURABLE | Metric snapshots |
| `rl_queue_v1` | DURABLE | Publish queue jobs |
| `rl_decisions_v1` | DURABLE | AI / operator decisions |
| `rl_activity_v1` | DURABLE | Activity feed |
| `rl_events_v1` | DURABLE | Ops event log (cap 500); not in backup export |
| `rl_schema_version` | DERIVED | Migration marker |
| `rl_active_campaign_id` | TEMPORARY | UI selection |
| `rl_working_account_id` | TEMPORARY | UI filter |
| `rl_campaign_snapshots_v1` | CACHE | Monitor digests — rebuildable |
| `rl_sidebar_collapsed` / `rl_content_view` / `rl_calendar_view` | TEMPORARY | UI prefs |
| `__rl_storage_probe__` | TEMPORARY | Capability probe |

### Disk

| Path | Class |
|------|-------|
| `server/.secrets.json` | SECRET |
| `.regeneluxe/` | reserved (local DB lives here after this sprint) |

---

## Target architecture

```
UI (React) → client memory mirror (sync API)
           → same-origin /api/data/*
           → typed repositories
           → local SQLite (.regeneluxe/local.db)
           ↔ outbox / jobs
           → optional Turso Cloud (remote)
```

**Technology decision:** see `DATA_ARCHITECTURE.md`.

---

## Target schema (relational)

Core tables (JSON payload columns for nested strategy/variants where helpful; indexed FK columns for queries):

- `meta` — schema_version, migration flags
- `campaigns`, `accounts`, `content_items`, `content_variants`
- `scheduled_publications`, `publication_attempts`
- `metric_snapshots`, `social_interactions`
- `campaign_state_snapshots`, `campaign_changes`
- `campaign_decisions`, `campaign_experiments`, `campaign_results`
- `attention_items`, `approvals`
- `campaign_brain_runs`, `campaign_monitor_runs`
- `jobs`, `outbox`, `sync_state`
- `app_settings`, `ui_prefs`
- `activity_events`, `ops_events`

Every syncable row: `id`, `created_at`, `updated_at`, `schema_version`, `revision`, `sync_status`, `deleted_at` (soft).

Timestamps stored as ISO-8601 **UTC**. Display timezone: IANA in settings (`America/New_York`).

---

## Migration mapping

| Source | Target |
|--------|--------|
| `rl_accounts_v1[]` | `accounts` |
| `rl_campaigns_v1[]` | `campaigns` (+ strategy JSON); `campaign.assets` → `content_items` if content store empty; `campaign.results` → `metric_snapshots` / `campaign_results` |
| `rl_content_v1[]` | `content_items` + `content_variants` |
| `rl_analytics_v1[]` | `metric_snapshots` (append-only) |
| `rl_inbox_v1[]` | `social_interactions` |
| `rl_queue_v1[]` | `jobs` + `scheduled_publications` |
| `rl_decisions_v1[]` | `campaign_decisions` |
| `rl_activity_v1[]` | `activity_events` |
| `rl_events_v1[]` | `ops_events` |
| `rl_settings_v1` | `app_settings` |
| selection / UI prefs | `ui_prefs` |
| `rl_campaign_snapshots_v1` | skip or import as cache rows (non-authoritative) |
| secrets file | **unchanged** (not migrated to synced tables) |

**Preserve:** all IDs, createdAt/updatedAt, relationships.

---

## Migration procedure

1. Detect durable localStorage keys present and `rl_db_migration` ≠ `complete_v1`
2. Snapshot: write `pre_migration_backup` JSON into `.regeneluxe/backups/` + keep localStorage intact
3. Validate records with Zod (lenient coerce + report)
4. Insert into SQLite transactionally
5. Verify counts (accounts, campaigns, content, analytics, …)
6. Mark `meta.localstorage_migration = complete_v1`
7. Set client flag `rl_db_migration=complete_v1` (do not wipe localStorage yet)
8. Rollback window: localStorage retained until explicit purge / N successful boots

**Idempotent:** re-entry with `complete_v1` skips destructive import.

---

## Rollback

1. Stop using SQLite mirror (feature flag / meta flag)
2. Restore from `.regeneluxe/backups/pre_migration_*.json` into localStorage via import API
3. Or copy backup DB file over `local.db` if SQLite-only corruption

Never silently delete/recreate a broken DB — quarantine + error surface in Settings diagnostics.
