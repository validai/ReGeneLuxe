# Provider checkpoint

This document records the Gmail provider baseline after the integration checkpoint.
It is not an instruction to reconnect, sync, or connect another provider.

## CURRENT STATE

Read-only inspection of the local SQLite database. No sync was run to produce these numbers.

| Item | Current value |
| --- | --- |
| Gmail status | `CONNECTED` |
| Connection state | `CONNECTED` |
| Account | `djcoast239@gmail.com` |
| Workspace | DJ Coast `ffaed2b8-ae61-46dd-87f8-77b3d3de3c66` |
| Indexed metadata rows | 1482 |
| Unique `providerMessageId` | 1482 |
| Duplicate `providerMessageId` | 0 |
| Missing `providerMessageId` | 0 |
| Last successful sync | `2026-10-07T18:35:38.169Z` |
| Last attempted sync | `2026-10-07T18:33:58.379Z` |
| Newest `receivedAt` | `2026-09-28T07:02:50.000Z` |
| Oldest `receivedAt` | `2026-08-29T22:58:02.000Z` |
| Vault reference | present; access and refresh material stay encrypted in the vault |
| Connection row secrets | none (`accessToken`, `refreshToken`, `googleSub` are not on the public row) |
| YouTube | `NOT_CONNECTED` |

Storage boundary:

- Metadata only. Live rows have no `body`, `bodyHtml`, raw MIME, or attachment binaries.
- 1480 of 1482 rows carry a capped snippet. Snippets stay in mailbox storage.
- Campaign Brain does not receive snippets, subjects, addresses, bodies, tokens, or `googleSub`.
- The only Gmail fields allowed into Campaign Brain are `gmailConnected`, `gmailLastSyncAt`, and `gmailFreshness`.

UI status comes from the stored `profile_connections` row via `publicGmailForProfile()`. Message rows can raise the displayed indexed count. They do not turn a connection into `CONNECTED`.

Historical `SYNC_GMAIL` job evidence: one `DONE` job. Its payload keys are `connectionId` and `managedProfileId` only.

## HISTORICAL STATE

This is not the current connection.

An earlier audit recorded:

- Connection `RECONNECT_REQUIRED`
- Error `REVOKED` — “Gmail access was revoked. Reconnect Gmail to continue syncing.”
- Last successful sync `2026-09-19T22:00:32Z`
- Last attempted sync `2026-09-28T15:44:50Z`
- 1000 indexed metadata rows, 1000 unique `providerMessageId`, 0 duplicates
- Newest `receivedAt` at that time `2026-09-19T21:06:45Z`

That grant was later replaced. Do not document or restore the revoked 1000-row state as current.

## Not fixed in this checkpoint

These audit findings are still open. This checkpoint does not remediate them.

- Delete/tombstone resurrection (`acc_test` and remote-delete reconciliation)
- Duplicate boot requests (`/api/db/health`, snapshot, sync)
- Overlapping connection-status definitions (`PROFILE_CONNECTION_STATES`, `CONNECTION_LABELS`, `CONNECTION_HINTS`, and `StatusBadge` tones)
- Producer-less jobs: `RUN_CAMPAIGN_MONITOR`, `RUN_CAMPAIGN_BRAIN`, `EVALUATE_EXPERIMENT`
- `runCampaignBrain()` is not wired into the worker
- Stale-code candidates (Vite shell, `server/index.js`, and related leftovers) were not deleted

`claimNextJob` still claims only `PENDING` and `ERROR`. Abandoned `RUNNING` leases are not auto-reaped here.

## Status model

The Gmail flow uses `CONNECTED`, `NOT_CONNECTED`, `RECONNECT_REQUIRED`, `SYNCING`, and `ERROR`.
Those labels still live in more than one module. Consolidating them is a later checkpoint.
