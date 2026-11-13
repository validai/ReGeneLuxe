# ReGeneLuxe — Living status (agent handoff)

Update this file at the end of substantial sprints. Prefer certification state over transient PIDs/logs.

## Frozen

| Layer | Status | Notes |
|-------|--------|-------|
| Runtime lifecycle | **FROZEN** | Certified at `db7db9c`. Canonical: `npm run start:canonical`. Do not polish-refactor launcher/ticker without defect evidence. |
| Independent profile model | **LOCKED** | One Google identity → one profile → one workspace. Signed-out `/signin` is the only new-profile door. |

## Certified

| Capability | State | Evidence |
|------------|-------|----------|
| Managed runtime (5174) | Certified | Dual health + detached PPID=1 + restart recovery |
| Health core vs optional AI | Certified | Missing AI is optional, not DEGRADED |
| Independent profile onboarding | **CERTIFIED** | `REGENELUXE_INDEPENDENT_PROFILE_FLOW_CERTIFIED` — E2E ×3 at `b266489` |
| Break/Harden/Certify process | Adopted | `docs/BREAK_HARDEN_CERTIFY.md` |
| Agent continuity protocol | Adopted | `docs/AGENT_CONTINUITY.md` |
| External agent pairing UX / transport truth | **CERTIFIED (local)** | Wizard + WAITING_FOR_AGENT + remote refuse; E2E×3 `test:e2e-agent-pairing`. Remote Grok **cannot** connect. |

## Active priorities / remains

1. Operator creates real alternate-artist **TEST** profile via signed-out Google flow (Cursor does not create it).
2. Provider **connection certification** in that TEST workspace (no provider writes until TEST cert path).
3. Layer 2 publishing stack: **IMPLEMENTED — AWAITING REAL CERTIFICATION** (`docs/LAYERED_BUILD.md`). Do not rebuild unless cert finds defects.
4. External Agent Bridge: local pairing UX/transport truth certified — **remote Grok cannot connect** until a secure outbound rendezvous/relay is approved and built (not in this sprint).

## Blockers

- Real Google OAuth for the alternate artist identity is operator-owned (allowlist / local access mode as configured).
- Provider GREEN requires controlled TEST-workspace certification — not unit tests alone.
- Remote external agents (Grok) blocked by local-only transport — do not tunnel 5174.

## Do not touch

- Investools ports `5173` / `3001` / `3010`
- `.env.local` secrets, SQLite data, campaigns/assets unless the task explicitly requires safe migration
- Broad `killall` / `pkill` node
