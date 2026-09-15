# ReGeneLuxe Data Sync Policies

## Authority

| Layer | Role |
|-------|------|
| Local SQLite (`.regeneluxe/local.db`) | **Canonical operational store** |
| operationalStore (memory) | UI cache hydrated from SQLite on boot |
| Turso | Optional cloud replica via outbox |
| localStorage | UI prefs only (`rl_sidebar_*`, view modes). Operational keys are migration fallback only. |

## Sync states

`LOCAL_ONLY` · `PENDING` · `SYNCING` · `SYNCED` · `ERROR` · `CONFLICT`

## Conflict rules

### Append-only
`analytics`, `decisions`, `events`, `activity`, `publication_attempts`, `brain_runs`, `monitor_runs`, `campaign_results`, `campaign_changes`, `metric_snapshots`

- Merge by stable `id`
- Never overwrite an existing local/remote row with a different payload
- Missing on one side → insert

### Mutable
`campaigns`, `accounts`, `content`, `settings`, `queue`, `inbox`, `campaign_snapshots`, `approvals`, `attention`, `experiments`, `publications`, `operators`, `managed_profiles`, `profile_connections`

- Compare `revision`
- Higher revision wins
- Equal → keep local
- Local newer → stay local, remain pending for push
- Soft-delete: apply when remote revision ≥ local

## Offline

App opens from local SQLite without Turso. Edits enqueue outbox (`PENDING`). Reconnect runs pull then push (`reconcileWithRemote`).

## Secrets

Never synced: AI keys, OAuth tokens, client secrets (server vault only).
