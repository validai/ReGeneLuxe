# ReGeneLuxe Auth (Phase 2A)

Google operator authentication uses **Auth.js v5** (`next-auth@5.0.0-beta.32`) with the Next.js App Router.

## Environment (server-only, never commit)

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs session JWTs |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | Canonical origin. Use `http://127.0.0.1:5174` (not `localhost`). Auth.js uses this for Google `redirect_uri`. |
| `AUTH_TRUST_HOST` | Required for `127.0.0.1` |
| `APP_ALLOWED_GOOGLE_EMAILS` | Pilot allowlist. Comma-separated. Fail closed if empty. |

`localhost` requests are redirected to `127.0.0.1` so Google authorization and token exchange use the same callback URI:

`http://127.0.0.1:5174/api/auth/callback/google`

Do not prefix these with `NEXT_PUBLIC_`. They must not appear in the client bundle, React props, HTML, localStorage, ordinary profile rows, Campaign Brain input, or Turso user/profile exports.

## Google Cloud

OAuth client (Web application) for project **ReGeneLuxe**:

- Authorized JavaScript origin: `http://127.0.0.1:5174`
- Authorized redirect URI: `http://127.0.0.1:5174/api/auth/callback/google`

Login scopes: `openid profile email` only. Gmail and YouTube are not requested at sign-in.

## Identity

- Durable key: Google `sub` (`operator.googleSub`, unique)
- Email is an attribute used for the private-pilot allowlist
- Operator row never stores access tokens, refresh tokens, or client secrets

## Routes

| Path | Behavior |
|---|---|
| `/signin` | Continue with Google |
| `/access-not-authorized` | Allowlisted-failed Google account |
| `/setup/profile` | First ManagedProfile intake |
| `/api/auth/*` | Auth.js handlers |
| `/api/health` | Public health |

Unauthenticated workspace requests redirect to `/signin` via `proxy.ts` (Next.js 16 request proxy + Auth.js `authorized` callback). Sign-out ends the session only and returns to `/signin`. It does not delete Operator, ManagedProfile, or operational data.
