# ReGeneLuxe

Private AI-native social campaign management for a single operator.

Operational class is the same as Buffer, Sprout Social, and Agorapulse: accounts, content, scheduling, publishing, inbox, and analytics. The differentiator is **Campaign Brain** — structured campaign planning and iteration from recorded evidence only.

This is a private local-first application, not a SaaS product.

## Architecture

| Layer | Implementation |
|---|---|
| UI + API | Next.js 16 App Router, React 19, TypeScript |
| Auth | Auth.js v5 + Google (`openid profile email`) |
| Identity | Operator → generic ManagedProfile (Profile Lane) |
| Local store | SQLite / libSQL — canonical operational authority |
| Cloud | Optional Turso replica (push + pull / reconciliation) |
| Social | `SocialConnector` registry with explicit readiness |
| Credentials | Encrypted server-side provider vault |
| Jobs | Durable jobs + outbox |
| Analytics | Append-only metric snapshots |
| Intelligence | Campaign Brain + CampaignMonitor |

Canonical runtime: **`http://127.0.0.1:5174`**. Next.js serves UI and `/api` on the same port.

## Identity model

```
Operator
  └── ManagedProfile (1 → many)
        ├── Social accounts
        ├── Profile connections
        ├── Campaigns
        ├── Content
        ├── Analytics (via related records)
        ├── Inbox
        ├── Publishing / queue
        └── Campaign Brain history
```

The operator is the Google-authenticated person. A ManagedProfile is a brand or creator the operator runs. They are not the same record. `activeProfileId` is a ManagedProfile id, never the operator id.

DJ Coast is the first pilot **data** record inside this generic model. It is not a special type, route, or schema.

## Local development

**Prerequisites:** Node.js 20+, npm.

Create `regeneluxe-web/.env.local` with the variable names listed below. Do not commit that file.

```bash
cd regeneluxe-web
npm install
npm run dev
```

Open **http://127.0.0.1:5174**.

Health check:

```bash
curl -sS http://127.0.0.1:5174/api/health
```

Expect `app: "ReGeneLuxe"`, `framework: "next"`, `canonicalUiUrl: "http://127.0.0.1:5174"`.

Do not use ports `5175`, `3200`, or a standalone `8787` for product verification.

Google Cloud (Web application) must include:

- Origin: `http://127.0.0.1:5174`
- Redirect: `http://127.0.0.1:5174/api/auth/callback/google`

## Environment variables

Names only. Values belong in `regeneluxe-web/.env.local` (gitignored). Never prefix these with `NEXT_PUBLIC_`.

### Auth and access

| Name | Purpose |
|---|---|
| `AUTH_SECRET` | Signs Auth.js session JWTs |
| `AUTH_GOOGLE_ID` | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth client secret |
| `AUTH_URL` | Canonical origin |
| `AUTH_TRUST_HOST` | Required for `127.0.0.1` |
| `APP_ALLOWED_GOOGLE_EMAILS` | Pilot allowlist (comma-separated; fail-closed if empty) |

### Cloud database

| Name | Purpose |
|---|---|
| `TURSO_DATABASE_URL` | Remote libSQL / Turso URL |
| `TURSO_AUTH_TOKEN` | Turso auth token |

### Provider app credentials

Used by `SocialConnector` adapters. Missing values yield `SETUP_REQUIRED`, not a fake Connected state.

| Name | Provider |
|---|---|
| `META_APP_ID` / `META_APP_SECRET` / `META_REDIRECT_URI` | Instagram, Facebook |
| `THREADS_APP_ID` / `THREADS_APP_SECRET` / `THREADS_REDIRECT_URI` | Threads (falls back to Meta app vars) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | YouTube (separate from operator login) |
| `X_CLIENT_ID` / `X_CLIENT_SECRET` / `X_REDIRECT_URI` | X |
| `TIKTOK_CLIENT_KEY` / `TIKTOK_CLIENT_SECRET` / `TIKTOK_REDIRECT_URI` | TikTok |
| `SOUNDCLOUD_CLIENT_ID` / `SOUNDCLOUD_CLIENT_SECRET` / `SOUNDCLOUD_REDIRECT_URI` | SoundCloud |

### Optional runtime

| Name | Purpose |
|---|---|
| `RL_PUBLIC_ORIGIN` | Public origin for OAuth redirect URIs |
| `RL_TOKEN_ENCRYPTION_KEY` | Provider token encryption key (else `server/.secrets.key`) |
| `RL_SECRETS_PATH` | Override secrets file path (tests) |

## Security

- Auth, Turso, and provider secrets are server-only.
- `.env.local` is gitignored (`*.local`). Never commit it.
- Social provider tokens live in an encrypted vault (`server/.secrets.json`, gitignored).
- Operator rows do not store OAuth access or refresh tokens.
- Secrets are stripped from backups, Campaign Brain context, React props, HTML, and `localStorage`.
- Google operator login requests `openid profile email` only. It does not grant Gmail or YouTube.

## Persistence

| Layer | Role |
|---|---|
| Local SQLite (`.regeneluxe/local.db`) | Canonical operational store |
| In-memory operational store | UI cache hydrated from SQLite |
| Turso | Optional cloud replica |
| `localStorage` | UI prefs only |

Sync states: `LOCAL_ONLY` · `PENDING` · `SYNCING` · `SYNCED` · `ERROR` · `CONFLICT`.

Local writes always succeed against SQLite. Cloud unavailable: data stays local, outbox marked `PENDING`, reconcile on reconnect.

**Append-only** (merge by id, never overwrite a different payload): analytics, decisions, events, activity, publication attempts, brain runs, monitor runs, campaign results/changes, metric snapshots.

**Mutable** (higher `revision` wins): campaigns, accounts, content, settings, queue, inbox, operators, managed profiles, profile connections, and related operational collections.

## Social operations

Readiness is declared. The UI does not show Connected, Published, Inbox, or analytics unless a real connection, manual record, or configured runtime backs it.

| Provider | Status | Notes |
|---|---|---|
| Instagram | `IMPLEMENTED` or `SETUP_REQUIRED` | Meta Graph adapter. Requires Meta app credentials. |
| Facebook | `IMPLEMENTED` or `SETUP_REQUIRED` | Meta Graph adapter. Requires Meta app credentials. |
| YouTube | `IMPLEMENTED` or `SETUP_REQUIRED` | Separate Google YouTube OAuth. Not granted by operator login. Channel attach is not complete. |
| X | `IMPLEMENTED` or `SETUP_REQUIRED` | OAuth 2.0 adapter. Requires X app credentials. |
| Threads | `IMPLEMENTED` or `SETUP_REQUIRED` | Meta/Threads adapter. Requires app credentials. |
| SoundCloud | `IMPLEMENTED` or `SETUP_REQUIRED` | Requires SoundCloud app credentials. |
| TikTok | `PROVIDER_REVIEW_REQUIRED` | Adapter present. Posting/analytics need TikTok approval. |
| LinkedIn | `UNSUPPORTED` | Stub only. |
| Gmail | Connection rail only | Not connected. Mail is not ingested. Not requested at login. |
| Mock | Test-only | Disabled in normal runtime. |

Publishing pipeline: Content → approval → `PUBLISH_CONTENT` job → connector → idempotent `publication_attempts` → `PUBLISHED` / `FAILED`. Default permission is `APPROVAL_REQUIRED`.

## Authentication

- Sign-in: `/signin` (Continue with Google).
- Unauthorized Google account: `/access-not-authorized`.
- First ManagedProfile: `/setup/profile`.
- Durable identity: Google `sub`. Email is an allowlist attribute, not the primary key.
- Unauthenticated workspace requests redirect to `/signin`.
- Sign-out ends the session and returns to `/signin`. It does **not** delete Operator, ManagedProfile, campaigns, content, accounts, or analytics.

## Quality gates

From `regeneluxe-web/`:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Production serve after build: `npm start` (same host and port).

## Repository structure

```
.
├── README.md                 # this file
└── regeneluxe-web/           # Next.js application
    ├── app/                  # App Router pages and API routes
    ├── auth.ts               # Auth.js (Node)
    ├── auth.config.ts        # Auth.js (edge-safe)
    ├── proxy.ts              # request protection
    ├── src/                  # UI, domain, client repositories
    ├── server/               # SQLite, auth, connectors, jobs, vault
    ├── docs/                 # AUTH, Profile Lane, data sync
    └── public/
```

Further detail: `regeneluxe-web/docs/AUTH.md`, `docs/PROFILE_LANE.md`, `docs/DATA_SYNC.md`, `docs/SOCIAL_OPERATIONS.md`.

## Current status

- Local SQLite is the operational authority. Turso reconciliation is implemented.
- Google operator authentication, allowlist, sign-out, and generic Profile Lane are implemented.
- Workspace routes, Campaign Brain, CampaignMonitor, jobs/outbox, and connector registry are in place.
- Live provider authorization (Gmail, YouTube channel, remaining social apps) is not finished.
- Additional ManagedProfiles are not created until Profile #1 is accepted.

## Near-term roadmap

1. Validate Profile Lane with Profile #1.
2. Gmail connection (separate from Google login).
3. YouTube channel connection (separate from Google login).
4. Remaining social provider authorization where credentials exist.
5. Real analytics and publishing expansion on connected accounts.
6. Additional ManagedProfiles after the pilot lane is accepted.
