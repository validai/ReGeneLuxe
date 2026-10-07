# Provider WIP handoff

Last hygiene pass: after `e988a6b` (truthful Data & Sync).  
Do **not** reconnect Gmail, sync Gmail, or start YouTube from this document.

## Identity

- Runtime account: `djcoast239@gmail.com`
- Active workspace: DJ Coast
- Valids Studio: infrastructure only
- Local SQLite: Healthy · Turso: Connected · Cloud sync: Synced · pending outbox: 0

## Gmail

| Item | State |
| --- | --- |
| Connection | `RECONNECT_REQUIRED` |
| Last error | `REVOKED` — “Gmail access was revoked. Reconnect Gmail to continue syncing.” |
| Last successful sync | 2026-09-19T22:00:32Z |
| Last attempted sync | 2026-09-28T15:44:50Z |
| Indexed count on connection | 1000 |
| Vault Gmail tokens | present (access + refresh ciphertexts) |
| Refresh | Google rejected the stored grant; reconnect is required. Not a missing-refresh-token case. |
| Scopes on connection | openid / profile / email / `gmail.readonly` |

### Existing `gmail_messages` (do not delete)

| Metric | Value |
| --- | --- |
| Rows | 1000 |
| Unique `providerMessageId` | 1000 |
| Duplicates | 0 |
| Oldest `receivedAt` | 2026-08-29T22:58:02Z |
| Newest `receivedAt` | 2026-09-19T21:06:45Z |
| Workspace | DJ Coast only |
| Sync status | all `SYNCED` (already in Turso) |
| Bodies / HTML / raw MIME | none stored |
| Snippets | yes, capped (max length 204) |
| Attachment binaries | none (`attachmentCount` 0) |
| Classification | **VALID_BUT_PARTIAL** — real mailbox metadata from one bounded historical sync, not fixtures |

Campaign Brain must not receive subjects, snippets, addresses, or bodies. Uncommitted WIP adds `gmailSignals.js` redaction so Brain only sees `{ gmailConnected, gmailLastSyncAt, gmailFreshness }`.

## YouTube

| Area | Status |
| --- | --- |
| OAuth start/callback rails | COMPLETE_RAIL (committed) |
| Same-account identity lock | COMPLETE_RAIL (committed) |
| Profile connection row | NOT_CONNECTED |
| Channel discovery / analytics / ingestion | NOT_IMPLEMENTED in live data (`youtube_videos` = 0) |
| Uncommitted YouTube-only files | none |

Do not run YouTube OAuth.

## Jobs / outbox

- Durable jobs present: `SYNC_REMOTE` × 20, all `DONE`
- `SYNC_GMAIL` / YouTube / `REFRESH_CONNECTION` rows: none
- RUNNING / abandoned leases: none
- Outbox: all `DONE` (including 1309 historical `gmail_messages` outbox rows). Pending: 0

`releaseJob` + workspace skip in the worker are uncommitted shared infra. Stuck `RUNNING` jobs are **not** auto-reaped by `claimNextJob` (it only claims `PENDING`/`ERROR`). No mutation performed this sprint.

## Uncommitted files

### Gmail-only

- `server/connectors/gmailConnection.js` + test
- `server/connectors/gmailSync.js` + test
- `server/connectors/providers/gmail.js` (revoked copy)
- `src/data/gmailSignals.js` (new)
- `src/data/ai/campaignBrain.js` (Brain Gmail signals)
- `src/data/ai/validator.js` (Gmail redaction)
- `src/screens/SettingsPage.jsx` remaining hunks (Syncing / job / message counts)
- `src/screens/profileChrome.test.jsx` remaining Gmail UI tests

### Shared / mixed (needed by a Gmail-only sprint; also touches YouTube copy or generic jobs)

- `server/auth/googleErrors.js` — rate-limit / 5xx / Gmail revoked copy
- `server/db/jobs.js` — `SYNC_GMAIL` type + generic `releaseJob` / `excludeIds`
- `server/jobs/worker.js` — Gmail dispatch + tenant job skip
- `server/db/index.js` — export `releaseJob`
- `src/data/profileModels.js` — `SYNCING`, `jobStatus`, `syncCursor`
- `src/data/connectionStatus.js` / `domain.js` / `StatusBadge.jsx` — `SYNCING` display

Later Gmail sprint can take the mixed job/error files with Gmail; YouTube-only files are already committed.

## Nested `ReGeneLuxe/` gitlink

Tracked as mode `160000` at `14a83f4` (Dec 2025 initial LICENSE + README of the same GitHub repo). Not application source. Dirty only because of an inner `.DS_Store`. Left in the tree; do not treat as a second project.

## Next safe Gmail step

1. Reconnect Gmail **for DJ Coast / `djcoast239@gmail.com` only** (same Google account as login).
2. Confirm vault + connection return `CONNECTED` without changing Google login scopes (`openid profile email`).
3. Run **metadata-only** bounded resync; upsert by `provider` + `providerMessageId` against the existing 1000 rows.
4. Do not store bodies or attachments. Do not feed mail into Campaign Brain.

Do not start that work until this handoff is accepted.
