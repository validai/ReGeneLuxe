# Scheduled publishing (local-first)

## Canonical pipeline

MARKETING_DRAFT → OPERATOR APPROVAL → AUTHORITATIVE SCHEDULE → RELEASE GATES → PROVIDER READINESS → PUBLISH ELIGIBILITY → SCHEDULED DISPATCH → PUBLISH_CONTENT → PROVIDER WRITE → PUBLICATION RECORD

Dry-run uses the same eligibility/recheck path and stops before the provider write.

## Autonomous processing

`instrumentation.ts` starts an in-process job ticker when the Next.js Node server boots (`next start` / `next dev`).

- Interval: `RL_JOB_TICKER_MS` (default 15000ms, minimum 5000ms)
- Disable: `RL_DISABLE_JOB_TICKER=1`
- Also reconciles approved+scheduled drafts into `PUBLISH_CONTENT` jobs
- Manual `POST /api/jobs/tick` remains for diagnostics

No browser, operator, or external-agent session is required for scheduled authority.

## Pause switch

`GET/POST /api/publishing/pause` with `{ paused: true|false }`

When paused, claimed marketing publishes defer without writing. Drafts/approvals/schedules remain.

## Missed window

If a job cannot validly execute within 15 minutes after `scheduledFor`, it is marked `SKIPPED` (no late send).

## Restart recovery

`claimNextJob` reclaims `RUNNING` jobs whose lease has expired. Idempotency keys and publication_attempts prevent duplicate provider sends.
