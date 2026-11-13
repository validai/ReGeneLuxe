# ReGeneLuxe runtime lifecycle

## Ownership

- Port: `127.0.0.1:5174`
- Authoritative browser/auth origin: `http://localhost:5174`
- Protected (never touch): Investools `5173`, `3001`, `3010`

## Canonical production start

```bash
npm run build
npm run start:canonical
```

Behavior:

1. Verifies project root is `regeneluxe-web`
2. Inspects 5174; reuses healthy ReGeneLuxe; **fails closed** on unrelated owners
3. Requires `.next` production build
4. Starts **one** detached `next start` (survives Cursor/agent shell exit)
5. Writes `.regeneluxe/runtime.json` + appends `.regeneluxe/runtime-lifecycle.log`
6. Dual `/api/health` + root probe before announcing ready

Stop (owner-verified only):

```bash
npm run start:stop
```

## Evidence on exit

`.regeneluxe/runtime-lifecycle.log` records startup, signals, child exit codes/signals, and sanitized fatals. Crashes are not auto-restarted by the launcher.

## Scheduler isolation

The in-process job ticker (`instrumentation.ts`) catches per-tick failures, skips overlaps, bounds work, and exposes heartbeat fields on `/api/health` → `scheduler`. Job/provider failures must not kill the Next process.

## Health: core vs optional AI

`/api/health` `status` reflects **core** runtime only (`OK` / `DEGRADED` / `UNHEALTHY`).

- Missing AI configuration is an **optional** component (`optionalComponents: ["ai_not_configured"]`).
- It must **not** alone set `status: DEGRADED` or look like a release-blocking failure.
- Operator copy distinguishes **Core system operational** from **Optional AI not configured**.
- Core publishing, scheduling, and workspace isolation do not require AI.

## Frozen lifecycle layer

Runtime lifecycle certified at `db7db9c` is **FROZEN** unless new evidence exposes an actual defect. Do not refactor the launcher/ticker for polish alone.
