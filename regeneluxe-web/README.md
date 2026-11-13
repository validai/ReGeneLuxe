# ReGeneLuxe

Application package for ReGeneLuxe. Product documentation lives in the [repository root README](../README.md).

## Local run

```bash
npm install
npm run build
npm run start:canonical
```

Canonical UI + API: **http://localhost:5174** (bind `127.0.0.1:5174`)

**Production runtime:** `npm run start:canonical` is the only managed production start path. It reuses a healthy ReGeneLuxe owner, fails closed on unrelated port owners, starts exactly one detached `next start`, and does not announce ready until dual `/api/health` + root probes succeed.

```bash
npm run start:status   # who owns 5174
npm run start:stop     # owner-verified SIGTERM only
```

Dev (hot reload):

```bash
npm run dev
npm run dev:status
```

One ReGeneLuxe server on that origin. Do not start a second copy and do not switch ports. Do not use broad `killall node` / port-range kills.

Server-only environment names (values in `.env.local`, never commit):

`AUTH_SECRET` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` · `AUTH_URL` · `AUTH_TRUST_HOST` · `APP_ALLOWED_GOOGLE_EMAILS` · `TURSO_DATABASE_URL` · `TURSO_AUTH_TOKEN`

Google redirect URI: `http://localhost:5174/api/auth/callback/google`

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Release-critical work also follows **BUILD → BREAK → HARDEN → POLISH → CERTIFY** (`docs/BREAK_HARDEN_CERTIFY.md`) and the layered promotion rules (`docs/LAYERED_BUILD.md`).
