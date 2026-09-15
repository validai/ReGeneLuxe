# ReGeneLuxe — Social Operations Architecture

## Data rails (Sprint 121 verification)

| Component | Status |
|-----------|--------|
| Local SQLite (libsql) | PARTIAL → product still dual-writes localStorage |
| Turso cloud push | PARTIAL (push/outbox; no pull) |
| Repositories | PARTIAL (server CRUD + client localStorage) |
| Migration localStorage→SQLite | COMPLETE (idempotent) |
| Outbox | PARTIAL |
| Jobs + worker (`/api/jobs/tick`) | COMPLETE (handlers for sync/publish/analytics/connection) |
| MetricSnapshots history | COMPLETE (append-only inserts; never overwrite by id reuse) |
| Campaign memory | PARTIAL (decisions/monitor local + durable collections) |
| UTC helpers | COMPLETE |
| Backups | PARTIAL (SQLite + localStorage export; secrets stripped) |
| Secret separation | COMPLETE for AI + provider tokens (encrypted vault) |

## Connector model

`server/connectors/` implements `SocialConnector` with explicit capabilities and readiness:

- `IMPLEMENTED` — credentials present; OAuth/API calls real
- `SETUP_REQUIRED` — missing app credentials (honest UI)
- `PROVIDER_REVIEW_REQUIRED` — TikTok posting/analytics approval
- `UNSUPPORTED` — LinkedIn stub / unknown platforms

Providers: Instagram, Facebook (Meta Graph), YouTube (Google), TikTok, X, Threads, SoundCloud. Mock connector is **test-only** (`RL_ALLOW_MOCK_CONNECTOR` / Vitest).

## Secrets

- File: `server/.secrets.json` (gitignored)
- Encryption key: `RL_TOKEN_ENCRYPTION_KEY` or `server/.secrets.key`
- Provider tokens stored encrypted (`v1:iv:tag:ciphertext`) under `providers.{provider}::{accountId}`
- Never sent to React props, backups, Campaign Brain context, logs, or HTML

## OAuth

- `POST /api/oauth/:provider/start` — beginAuth + state
- `GET /api/oauth/:provider/callback` — completeAuth, upsert safe account metadata, redirect with operator-friendly errors

## Publishing

Pipeline: Content → Approval → `PUBLISH_CONTENT` job → connector → `publication_attempts` (idempotent) → content `PUBLISHED` / `FAILED`.

Permissions: `ANALYZE_ONLY` | `DRAFT_ONLY` | `APPROVAL_REQUIRED` (default) | `AUTO_PUBLISH`.

## Analytics

`POST /api/analytics/refresh` enqueues `REFRESH_ANALYTICS`. Normalized metrics use null for unsupported keys.

## Campaign Brain

Structured output validated (`validateBrainOutput`). Triggers via `shouldRunCampaignBrain`. Outcomes: POSITIVE / NEGATIVE / INCONCLUSIVE / TOO_EARLY / NO_DATA.
