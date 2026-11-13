# ReGeneLuxe — Layered Build / Promotion Standard

Permanent architecture and engineering rule. Takes precedence over feature-count goals.

## Layers

### Layer 1 — Foundation / Trust
Identity · workspace isolation · credential security · assets · audit history · role/capability enforcement · approvals · idempotency · recovery.

No future AI or agent capability may bypass this layer.

### Layer 2 — Execution Engine
Asset → Draft → Approval → Schedule → Readiness → Provider dispatch → Verification → Result.

**Current status (HEAD `e213c28` and later):** IMPLEMENTED — AWAITING REAL CERTIFICATION.

Do not rebuild the marketing→provider bridge, scheduler, pause switch, restart recovery, deadline handling, duplicate protection, or publication recording unless certification exposes an actual defect.

Promotion path:

TEST workspace → provider configuration → controlled dry run → operator-approved harmless real provider test → provider result verification/readback → GREEN → production promotion.

### Layer 3 — Evidence Engine
Provider results · analytics · interactions · relationships · campaign/asset attribution · performance history.

No invented data.

### Layer 4 — Decision Assistance
Recommendations, comparisons, campaign lessons, Next Move, reweighting suggestions.

ReGeneLuxe recommends. Humans / authorized agents decide.

### Layer 5 — Supervised Autonomy
Only after proven evidence + execution reliability. Bounded operational decisions under explicit operator policy. High-impact decisions remain controlled.

### Layer 6 — Regenerative Engine
Long-term destination: full GOAL → PLAN → CREATE/ADAPT → APPROVE → DISTRIBUTE → ENGAGE → OBSERVE → LEARN → ADJUST → CONTINUE cycle.

ReGeneLuxe is the durable system of record. External agents (e.g. Grok) are optional specialists.

## Promotion gate

Code, UI, tests, API response, or OAuth success alone are not enough.

Require: correctness · reliability · security · usability.

Provider-facing work also requires: TEST certification → controlled real test → result verification → production promotion.

## Fail-closed

If identity, approval, destination, asset version, schedule, provider readiness, release gate, or authorization is ambiguous: **do not execute**. Report the exact blocker.

## Production rule

TEST first. PRODUCTION second.

Never use DJ Coast (or another production workspace) as the first experiment for a new provider-write mechanism when a controlled TEST workspace can validate it.

## Autonomy rule

Every increase in autonomy must be earned by the layer beneath it.

Prove: trustworthy evidence · bounded decision · safe execution · rollback/recovery · operator inspect/override.

## Build speed

Complete small end-to-end vertical slices. Prefer finishing the release-critical path:

ASSET → TEAM DRAFT → APPROVAL → SCHEDULE → PROVIDER → PUBLISH → VERIFY → RESULT

before adding horizontal features.

## Two independent “15-minute” clocks

Do not conflate:

1. **External Agent session TTL** (`SESSION_TTL_MS` in `server/externalAgent/store.js`) — how long an agent handshake session lasts.
2. **Scheduled publish lateness window** (`SCHEDULE_WINDOW_MS` in `server/marketingDrafts/dispatchPipeline.js`) — if a scheduled post cannot validly execute within this tolerance after `scheduledFor`, mark SKIPPED (no late send).

A third unrelated 15-minute clock exists for the **ephemeral pilot publish approval** (`APPROVAL_TTL_MS` in `src/data/publishApproval.js`). Marketing durable schedule-bound approval does not use that TTL.
