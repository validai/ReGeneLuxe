# ReGeneLuxe

Application package for ReGeneLuxe. Product documentation lives in the [repository root README](../README.md).

## Local run

```bash
npm install
npm run dev
```

Canonical UI + API: **http://127.0.0.1:5174**

One ReGeneLuxe dev server on that origin. Do not start a second copy and do not switch ports.

```bash
npm run dev:status
```

If 5174 already has a healthy ReGeneLuxe Next.js process, `npm run dev` reuses it.

Server-only environment names (values in `.env.local`, never commit):

`AUTH_SECRET` · `AUTH_GOOGLE_ID` · `AUTH_GOOGLE_SECRET` · `AUTH_URL` · `AUTH_TRUST_HOST` · `APP_ALLOWED_GOOGLE_EMAILS` · `TURSO_DATABASE_URL` · `TURSO_AUTH_TOKEN`

Google redirect URI: `http://127.0.0.1:5174/api/auth/callback/google`

## Quality gates

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
