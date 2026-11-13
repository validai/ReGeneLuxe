# ReGeneLuxe — New Agent Continuity Protocol

Permanent rule. A new Cursor/AI coding agent must **never** begin ReGeneLuxe work as a blank-slate agent.

Every new agent must inherit the established ReGeneLuxe engineering workflow **before** editing code.

Companion docs: `docs/LAYERED_BUILD.md` · `docs/BREAK_HARDEN_CERTIFY.md` · `docs/RUNTIME.md` · `docs/AUTH.md` · `docs/STATUS.md`

---

## Required startup

Before making changes, every new agent must read:

1. `AGENTS.md`
2. `docs/LAYERED_BUILD.md`
3. `docs/BREAK_HARDEN_CERTIFY.md`
4. relevant `.cursor/rules/*`
5. current README operational guidance
6. relevant current architecture/docs for the requested subsystem

Then inspect:

- current `HEAD`
- `origin/main`
- working tree
- live runtime identity (5174 ownership)
- current `/api/health`
- current implemented state of the requested feature
- most recent related commits

Do **not** assume an old handoff or exploration result is current.

---

## Inherit the workflow

**BUILD → BREAK → HARDEN → POLISH → CERTIFY**

Happy-path completion is **not** GREEN.

A feature is not finished because code exists, UI renders, tests pass, an API returns 200, or a build succeeds.

The agent must try to break it.

---

## Operator is not the first tester

Never give the operator a newly invented click path and call it ready without testing the equivalent path first.

For user-facing workflows:

1. exercise the path using test/E2E infrastructure
2. break it
3. repair it
4. rerun it
5. only then give operator instructions

If you cannot prove the path: **say so**. Do not send the operator on speculative UI journeys.

---

## Do not rebuild what already exists

Before implementing, inspect current code and recent commits.

Classify the requested capability:

- already implemented
- partially implemented
- implemented but uncertified
- blocked by operator configuration
- blocked externally
- actually missing

Do not rebuild an existing subsystem because an older exploration map says it was absent.

---

## Preserve architecture

ReGeneLuxe is the durable execution engine.

External agents may think, plan, prepare, recommend.

ReGeneLuxe owns authoritative state, assets, accounts, approvals, schedules, publishing, verification, results, and evidence/history.

Do not make a temporary agent the system of record.

---

## Profile model

**ONE GOOGLE IDENTITY = ONE INDEPENDENT REGENELUXE PROFILE = ONE WORKSPACE**

No profile creates, parents, owns, or authorizes another profile.

New profile onboarding begins while **signed out** (`/signin`).

---

## Runtime rule

Port **5174** belongs to ReGeneLuxe. Use the canonical runtime lifecycle (`npm run start:canonical` / `start:status` / `start:stop`).

Never perform broad Node/process kills. Verify ownership before stop/restart.

Runtime stability layer is **frozen** (certified at `db7db9c`) unless new evidence demonstrates a defect.

---

## Cross-project rule

ReGeneLuxe work must not touch Investools or other projects unless explicitly instructed.

Protected Investools ports: `5173`, `3001`, `3010`.

Verify paths and ports before process actions.

---

## Safety

Fail closed on ambiguity involving identity, workspace, asset, approval, schedule, provider, release gate, or authorization.

Never invent success.

---

## Release / certification

TEST first. Production second.

Provider-facing features require controlled TEST-workspace certification before production promotion.

---

## Continuity handoff

Before ending a substantial sprint, leave durable information so the **next** agent can continue without chat memory.

Update appropriate docs/rules with: what changed · canonical architecture · current status · known blockers · what is frozen · what remains · exact certification state.

Do not clutter docs with transient terminal details. Prefer `docs/STATUS.md` for living status.

---

## New agent first response

When a new agent takes over, its first status should confirm:

- rules/docs read
- HEAD
- tree state
- runtime state
- relevant existing implementation found
- intended task
- boundaries it will preserve

Only then begin implementation.

**Agent replacement must not reduce engineering quality.** A new agent should behave like the continuation of the same disciplined engineering team.
