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
| DJ Coast / non-TEST provider write guard | **IN PLACE** | `productionWriteGuard.js` — DJ Coast always blocked; non-TEST blocked unless `REGENELUXE_ALLOW_PRODUCTION_PROVIDER_WRITES=1`. |
| Provider live certification (Layer 2) | **BLOCKED** | YouTube identity/read OK; `youtube.upload` still absent. Scope-truth UI fixed; upgrade path self-certified. |
| YouTube scope truth / UI consistency | **RESOLVED** | Settings + Certification derive from vault scopes. `test:e2e-youtube-scope` ×3. |
| YouTube Accounts upload operator path | `OPERATOR_PATH_SELF_CERTIFIED=YES` | Mocked upgrade path certified; live grant still readonly until one Accounts consent. |

## Active priorities / remains

1. **S!xd9** TEST live: Gmail + YouTube **CONNECTED** (YouTube **READ ONLY**). DJ Coast writes hard-blocked.
2. Operator: Accounts → YouTube connect to add `youtube.upload` (do **not** Settings-reconnect for identity). Then Instagram → Facebook → TikTok identity.
3. After upload scope + Meta connects: Cursor runs one harmless `[REGENELUXE CERT]` live post per publish-capable provider + verify/readback.
4. Layer 2 publishing stack: **IMPLEMENTED — AWAITING REAL PROVIDER CERT** (`docs/LAYERED_BUILD.md`).
5. External Agent Bridge: local pairing UX certified; remote Grok cannot connect until rendezvous/relay exists.

## Blockers

- YouTube: `IDENTITY_CONNECTED` + `READ_CONNECTED`; **missing** `youtube.upload` → not `PUBLISH_CAPABLE` / not `CERTIFIED`.
- Instagram / Facebook / TikTok / LinkedIn: not connected in S!xd9 TEST.
- Provider GREEN requires controlled real test evidence in TEST — not unit tests alone.
- Remote external agents (Grok) blocked by local-only transport — do not tunnel 5174.
- Provider post delete teardown not implemented (archive/manual where needed).

## Do not touch

- Investools ports `5173` / `3001` / `3010`
- `.env.local` secrets, SQLite data, campaigns/assets unless the task explicitly requires safe migration
- Broad `killall` / `pkill` node
