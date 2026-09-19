# ReGeneLuxe Auth (Phase 2A)

Google account authentication uses **Auth.js v5** (`next-auth@5.0.0-beta.32`) with the Next.js App Router.

## Two identity planes

These are intentionally separate. Do not mix them in runtime UX.

| Plane | Identity | Used for |
|---|---|---|
| Infrastructure | Valids Studio (`validsstudio@gmail.com`) | Google Cloud project ownership, OAuth app, API enablement, Turso/database administration, deployments, GitHub/admin, developer tooling |
| Runtime ReGeneLuxe account | Authenticated Google identity on the allowlist (pilot: `djcoast239@gmail.com`) | Sign-in, workspace ownership, ManagedProfiles, connections, campaigns, content, analytics |

The Google Cloud OAuth client stays owned/configured through Valids Studio. That is not the normal application user and must not appear in sidebar, Settings Account, or other runtime chrome.

## Runtime hierarchy

Authenticated Google account → ReGeneLuxe Account/Workspace → many ManagedProfiles → Connections / Campaigns / Content / Analytics

ManagedProfile remains generic data (Profile #1 in the pilot is DJ Coast). Additional profiles can be added later under the same account. Do not require a separate ReGeneLuxe login per profile.

Durable persistence still uses the `operators` collection for the account row so it does not collide with social `accounts`. Public/UX term is **Account**.

## Environment (server-only, never commit)

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs session JWTs |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | Canonical origin. Use `http://127.0.0.1:5174` (not `localhost`). Auth.js uses this for Google `redirect_uri`. |
| `AUTH_TRUST_HOST` | Required for `127.0.0.1` |
| `APP_ALLOWED_GOOGLE_EMAILS` | Runtime account allowlist. Comma-separated. Fail closed if empty. Pilot: `djcoast239@gmail.com`. |

`localhost` requests are redirected to `127.0.0.1` so Google authorization and token exchange use the same callback URI:

`http://127.0.0.1:5174/api/auth/callback/google`

Do not prefix these with `NEXT_PUBLIC_`. They must not appear in the client bundle, React props, HTML, localStorage, ordinary profile rows, Campaign Brain input, or Turso user/profile exports.

## Google Cloud

OAuth client (Web application) for project **ReGeneLuxe** (infrastructure owner: Valids Studio):

- Authorized JavaScript origin: `http://127.0.0.1:5174`
- Authorized redirect URI: `http://127.0.0.1:5174/api/auth/callback/google`

Login scopes: `openid profile email` only. Gmail and YouTube are incremental, explicit, and requested later for the **same** Google `sub`.

## Identity

- Durable key: Google `sub` (`operator.googleSub` / account, unique)
- Email is an attribute used for the private-pilot allowlist
- Account row never stores access tokens, refresh tokens, or client secrets
- Gmail/YouTube OAuth uses `login_hint` for the signed-in email and `prompt=consent`
- If Google returns a different `sub` (or email), do not attach it. Show: `This Google account does not match the ReGeneLuxe account currently signed in.`
- YouTube Brand Accounts/channels (for example Coast Entertainment) are selectable under the signed-in Google identity. They are not a second ReGeneLuxe login.

If a leftover non-allowlisted account still owns ManagedProfiles and the signing-in allowlisted account owns none, those profiles are adopted without duplication. Previous account rows are preserved.

## Routes

| Path | Behavior |
|---|---|
| `/signin` | Sign in to your ReGeneLuxe account |
| `/access-not-authorized` | Allowlist-failed Google account |
| `/setup/profile` | First ManagedProfile intake |
| `/api/auth/*` | Auth.js handlers |
| `/api/health` | Public health |

Unauthenticated workspace requests redirect to `/signin` via `proxy.ts` (Next.js 16 request proxy + Auth.js `authorized` callback). Sign-out ends the session only and returns to `/signin`. It does not delete Account, ManagedProfile, or operational data.
