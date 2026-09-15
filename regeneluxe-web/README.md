# ReGeneLuxe

Application package for ReGeneLuxe. Product documentation lives in the [repository root README](../README.md).

## Local run

```bash
npm install
npm run dev
```

Canonical UI + API: **http://127.0.0.1:5174**

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
