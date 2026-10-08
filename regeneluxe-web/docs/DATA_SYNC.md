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

These are database replica states. They are not Gmail/YouTube connection states and they are not social account states. See `docs/CONNECTION_STATUS.md`.

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

## Durable tombstones

`repository.remove()` soft-deletes the entity (`deleted_at`, bumped `revision`) and enqueues one `DELETE` outbox row, keyed `delete:<collection>:<id>`. Repeating remove does not clear the tombstone or insert a second delete. Normal reads omit tombstoned rows. Sync still loads them.

Identifiers from `createId` are not reused. Calling `upsert` on a tombstoned id returns the tombstone and does not clear `deleted_at`. Intentional recreation uses a new id. Pull is not restore.

### Conflict rule

| Local | Remote | Result |
| --- | --- | --- |
| Tombstone | Live, any revision | Keep the local tombstone. Pull does not resurrect. |
| Tombstone | Tombstone | Stay deleted. The higher revision updates tombstone metadata. |
| Live | Tombstone, remote revision ≥ local | Local becomes a tombstone. |
| Live | Tombstone, remote revision < local | Keep the local live row. Counted as a conflict. |
| Live | Live | Higher revision wins. Equal keeps local. |
| Missing | Tombstone | Insert a local tombstone so a later live copy cannot recreate the row. |
| Missing | Live | Insert the live row. |

Workspace: when both rows have `managedProfileId` and they differ, the tombstone is not applied across that boundary.

### DELETE done

`DONE` is written only after a remote tombstone exists. If the remote row is missing, push inserts one. If it is already tombstoned at an equal or newer revision, push leaves it. A network failure leaves the outbox `ERROR` and the local tombstone in place. Due `ERROR` rows are claimed again. `DONE` does not mean "the remote select returned no row."

Restart keeps the tombstone because it is a row in local SQLite. A later pull of a stale live copy does not clear `deleted_at`.

Tombstones are not garbage-collected. Compaction can wait until a remote tombstone is known to be ahead of every replica.

## Bootstrap

`WorkspaceProviders` owns application boot through `bootstrapDurableStore()`. React Strict Mode may run that effect twice. Both calls share one in-flight boot.

One boot does four different things:

| Concern | Cadence |
| --- | --- |
| Local migration | One `POST /api/migrate/local-storage` per boot. The server decides whether work remains. Later mounts do not call it. |
| Operational snapshot | One `GET /api/data/snapshot` to hydrate memory. A successful Turso reconcile takes one follow-up snapshot. Route changes do not. |
| Database health | One `GET /api/db/health` during boot. Settings may read health again. Concurrent callers share the in-flight request. A health response that started before a newer read cannot overwrite it. |
| Cloud reconcile | One `POST /api/sync` with `{ pull: true, push: true }` after the local snapshot. It does not block the shell. A failed reconcile leaves the local app usable and does not retry in a loop. |

`GET /api/sync` reads `getSyncStatus()`. It probes Turso when configured and does not push, pull, or write `last_sync_at`. Boot does not call it.

`POST /api/sync` is the mutation. `{ pull: true, push: true }` runs `reconcileWithRemote()`, which updates `last_sync_at`. Sync now uses this POST. A second click while that POST is in flight waits on the same request. A click after it finishes runs again.

Navigation inside the workspace layout does not remount `WorkspaceProviders`, so it does not repeat migration, the boot snapshot, or boot reconcile. Opening Settings reads health again.

## Offline

App opens from local SQLite without Turso. A local delete still hides the entity and keeps the tombstone while the outbox stays `PENDING`. Edits enqueue outbox (`PENDING`). Reconnect runs pull then push (`reconcileWithRemote`). Cloud outage does not undelete.

## Secrets

Never synced: AI keys, OAuth tokens, client secrets (server vault only).

Profile image bytes stay in the local media store (`.regeneluxe/media/`). `managed_profiles` syncs `avatarMediaId` and `avatarUrl` references only — never inline `data:` blobs or binary image payloads.
