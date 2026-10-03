# ReGeneLuxe Security Audit

Private application security review. This document does not contain credentials, tokens, or live identifiers beyond the public product identity model.

**Canonical local origin:** `http://127.0.0.1:5174`  
**Identity rule:** one email = one ReGeneLuxe account = one brand = one workspace  
**Gmail / YouTube ingestion:** not resumed in this sprint  

## 1. Threat model

### Assets

| Asset | Location | Sensitivity |
| --- | --- | --- |
| Google identity (`googleSub`) | operators table, Auth.js JWT | Critical |
| ReGeneLuxe session cookie | HttpOnly Auth.js JWT | Critical |
| Workspace ownership | `managed_profiles.ownerOperatorId` | Critical |
| Gmail / YouTube access | encrypted provider vault + profile connections | Critical |
| Social provider tokens | AES-256-GCM vault (`server/.secrets.json`) | Critical |
| OAuth client secrets | server env + vault | Critical |
| Turso URL / token | server env only | Critical |
| Local SQLite | `.regeneluxe/local.db` | High |
| Cloud-synced entities | Turso `entities` payloads | High |
| Media files | `.regeneluxe/media` | Medium |
| Campaign Brain context | AI complete payload | High |
| Analytics / jobs / outbox | SQLite | Medium |
| Backups / exports | `.regeneluxe/backups` | High |

### Actors

Unauthenticated remote caller, authenticated wrong account, malicious OAuth callback, compromised browser/session, malicious upload, malformed API caller, compromised provider, supply-chain package, accidental operator mistake.

### Categories covered

Authentication bypass, authorization/IDOR, token theft, secret leakage, CSRF, XSS, SSRF, SQL injection, path traversal, open redirect, OAuth state abuse, session fixation, mass assignment, unsafe upload, rate-limit abuse, job replay, sensitive logging, backup leakage, AI-context leakage, prompt injection.

## 2. Findings summary

| Severity | Count (this sprint) | Status |
| --- | --- | --- |
| CRITICAL | 1 | Fixed |
| HIGH | 8 | Fixed |
| MEDIUM | 7 | Fixed or mitigated |
| LOW | 6 | Documented / partial |
| INFO | 5 | Documented |

## 3–7. Finding register

### CRITICAL

1. **Unauthenticated OAuth start could create/update accounts**  
   `POST /api/oauth/[provider]/start` accepted a client account snapshot and upserted it without an operator session.  
   **Fix:** require workspace auth, Origin check, rate limit, never upsert from the request body, bind `operatorId` into OAuth state.

### HIGH

2. **Generic data APIs previously dumped or mutated the whole database**  
   Collection, snapshot, backup, sync, jobs/tick, secrets, AI, publish, connections.  
   **Fix:** `requireWorkspaceApi`, tenant filters, hidden Gmail/operator collections, private cache headers.

3. **Media `storedName` was joined without confinement**  
   A tampered media JSON file could point at `../../.env.local`.  
   **Fix:** ID allowlist, basename match, realpath prefix check, magic-byte MIME check.

4. **Vault `decryptSecret` echoed non-v1 plaintext**  
   **Fix:** refuse non-`v1:` AES-GCM payloads.

5. **Auth.js `toCanonicalPath` treated `//host` as a local path**  
   Protocol-relative open redirect risk.  
   **Fix:** reject `//`, `://`, and non-canonical hosts.

6. **Backup export/import was whole-database**  
   Could include another tenant's rows and Gmail messages.  
   **Fix:** workspace-scoped export, skip `gmail_messages`, lock identity fields on import, never return backup filesystem paths.

7. **Turso pull could last-write-wins identity fields**  
   **Fix:** `applyRemoteRecord` preserves `googleSub`, `ownerOperatorId`, `managedProfileId`.

8. **Job tick could execute another workspace's jobs**  
   **Fix:** stamp `managedProfileId`, skip/release foreign jobs.

9. **OAuth `returnTo` was stored unsanitized**  
   **Fix:** `safeReturnTo` at state create and consume.

### MEDIUM

10. CSRF Origin check on remaining mutators (profiles, Google connections, OAuth start).  
11. Public `/api/db/health` leaked error strings — now authenticated and sanitized.  
12. Meta writes were unrestricted — allowlist `active_campaign_id`, `working_account_id`, `active_profile_id`.  
13. Mass assignment of `connectionState` / `googleSub` on collection writes — locked to existing records.  
14. Missing security headers — CSP, frame deny, nosniff, Referrer-Policy, Permissions-Policy.  
15. Campaign Brain / AI complete now sanitize context and label provider content as untrusted data.  
16. Rate limits on AI, secrets, jobs, OAuth start, Google connection actions.

### LOW

17. `/api/status` still reports connected provider names (not tokens).  
18. Legacy media files without `managedProfileId` remain readable by any signed-in operator on the same machine.  
19. CSP allows `'unsafe-inline'` / `'unsafe-eval'` because Next.js requires them.  
20. In-memory rate limiter is per-process, not shared.  
21. `trustHost: true` remains; redirect_uri is forced to `AUTH_URL` / `127.0.0.1:5174`.  
22. Generic provider OAuth callbacks remain public (required) but consume single-use state bound to operator/workspace.

### INFO

23. Local SQLite file mode is operator-machine trust; disk permissions are OS-level.  
24. Prompt-injection boundary is documented; no tool-calling from email/social text.  
25. Public health reports `aiConfigured` and `cloudConfigured` booleans only.  
26. Valids Studio remains infrastructure-only and is not allowlisted for login.  
27. Gmail ingestion is not started by this sprint.

## 8. Authentication

- Auth.js v5 JWT + Google with `openid profile email` only.  
- Durable identity is `googleSub`, not email.  
- `APP_ALLOWED_GOOGLE_EMAILS` is server-side and fail-closed.  
- `authorized()` requires `session.operatorId`.  
- Sign-out clears the session cookie and does not delete workspace data.  
- Callback errors map to operator-safe copy.

## 9. Session / cookies

- HttpOnly, SameSite=lax, path `/`.  
- `Secure` only when `AUTH_URL` is HTTPS so local HTTP `127.0.0.1` still works.  
- 30-day max age, 24-hour rotation window.  
- Tokens are not readable from application JavaScript.

## 10. Authorization / IDOR

Server derives workspace from the signed-in operator. Client-supplied `workspaceId` / `accountId` / `campaignId` must match `managedProfileId` or the request is 404. Gmail rows are never returned to the client collection API.

## 11. OAuth

- 24-byte hex state, 15-minute TTL, single use.  
- PKCE on Google/X.  
- Gmail/YouTube must match signed-in `googleSub` / email.  
- Mismatch clears tokens and resets connection identity fields.  
- Callback `returnTo` is a local path only.

## 12. Secret storage

AES-256-GCM, random 12-byte IV, auth tag, `v1:iv:tag:data`. Master key from env or `server/.secrets.key` mode `0600`. Tokens stay out of entities, backups, Turso payloads, and Campaign Brain.

## 13. Repository secret scan

Searched for `AUTH_SECRET`, `AUTH_GOOGLE_SECRET`, `TURSO_AUTH_TOKEN`, `client_secret`, `access_token`, `refresh_token`, `BEGIN PRIVATE KEY`.

**Do not print values.** Expected locations:

| Path | Type | Tracked? | Action |
| --- | --- | --- | --- |
| `.env.local` | runtime secrets | ignored (`*.local`) | keep untracked |
| `server/.secrets.json` | vault | gitignored | keep untracked |
| `server/.secrets.key` | vault key | gitignored | keep untracked |
| `.regeneluxe/` | sqlite/media/backups | gitignored | keep untracked |
| tests/fixtures | fake tokens such as `sk-test-do-not-leak` | tracked | OK |

No live credential rotation is required unless an operator committed a real `.env.local` outside this tree.

## 14. Client-bundle secret scan

`NEXT_PUBLIC_` is not used for Auth, Turso, vault, or Google client secret. Server modules live under `server/` and `auth.ts`. Production `next build` must not include `AUTH_SECRET` / `TURSO_AUTH_TOKEN` / `RL_TOKEN_ENCRYPTION_KEY`.

## 15. SQLite

Entity SQL uses parameterized `?` placeholders. Collection names are allowlisted. Hostile table names cannot be selected from the HTTP API.

## 16. Turso

`TURSO_AUTH_TOKEN` is server-only. Sync APIs require a workspace session. Remote payloads are identity-locked before local upsert.

## 17. Sync conflicts

Existing local `googleSub`, `ownerOperatorId`, and `managedProfileId` win over remote last-write-wins.

## 18. API route audit

| Route | Method | Auth | Workspace | Validation | Rate limit | Side effects | Secrets |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/api/auth/*` | GET/POST | Auth.js | n/a | Auth.js | Auth.js | session | AUTH_SECRET |
| `/api/health` | GET | public | no | none | no | none | booleans only |
| `/api/status` | GET | public | no | none | no | none | provider names |
| `/api/db/health` | GET | yes | yes | none | no | none | no errors/paths |
| `/api/operator/session` | GET | yes | yes | none | no | none | public operator |
| `/api/profiles` | GET/POST | yes | yes + CSRF POST | profile fields | no | create workspace | no |
| `/api/profiles/[id]` | GET/PATCH/POST | yes | owner check + CSRF | allowlisted fields | no | update | no |
| `/api/data/collection` | * | yes | tenant + CSRF | collection allowlist | no | CRUD | stripped |
| `/api/data/snapshot` | GET | yes | scoped | none | no | none | stripped |
| `/api/backup` | GET/POST | yes | scoped + CSRF | snapshot kind | no | import | stripped |
| `/api/sync` | GET/POST | yes | CSRF POST | flags | no | Turso | no tokens |
| `/api/jobs/tick` | POST | yes | CSRF + job owner | type regex | 20/min | jobs | no |
| `/api/secrets` | POST | yes | CSRF | kind=ai | 10/min | vault AI key | writes AI key |
| `/api/ai/complete` | POST | yes | CSRF | body | 20/min | provider call | sanitized context |
| `/api/publish` | POST | yes | CSRF + record owner | ids | no | enqueue publish | no |
| `/api/analytics/refresh` | POST | yes | CSRF + account owner | accountId | no | enqueue | no |
| `/api/connections` | GET/POST | yes | CSRF POST | action + account | no | disconnect/sync | vault status only |
| `/api/connections/google` | GET/POST | yes | CSRF POST | kind/action | 20/min | Gmail/YT | no tokens |
| `/api/oauth/*/start` | GET/POST | yes | CSRF POST | accountId | 10/min | OAuth start | no |
| `/api/oauth/*/callback` | GET | public + state | state operator bind | state | no | token exchange | vault write |
| `/api/connections/google/*/callback` | GET | public + session | identity match | state | no | token exchange | vault write |
| `/api/media/[id]` | GET | yes | media owner | id charset | no | none | bytes |
| `/api/migrate/local-storage` | POST | yes | CSRF | dump object | no | one-time migrate | stripped |

## 19. CSRF

Mutating routes call `requireWorkspaceApi({ mutate: true })`, which rejects disallowed `Origin` and cross-site `sec-fetch-site`. Session cookies are SameSite=lax.

## 20. XSS

No `dangerouslySetInnerHTML`. User/provider strings render as React text. URL fields reject `javascript:` / `data:` / `file:`.

## 21. SSRF

No server fetch of operator-supplied website/social URLs. Provider HTTP calls use fixed API hosts. `isSafeExternalFetchUrl` rejects loopback, RFC1918, and link-local/metadata addresses for any future fetch.

## 22. Open redirects

Auth.js `redirect` and OAuth `returnTo` are canonical-origin or local-path only.

## 23–24. Media

PNG/JPEG/WebP, 500 KiB, magic bytes, random `med_` id, confined directory, `nosniff`, private cache. SVG/HTML/scripts rejected. Traversal IDs rejected.

## 25. URL validation

Profile website/public URL and social URL parsers allow http(s) only.

## 26. Jobs / outbox

`/api/jobs/tick` is authenticated, CSRF-protected, type-allowlisted, workspace-filtered, leased, and idempotent where keys exist. GET is 405.

## 27. Gmail privacy

`gmail_messages` is a hidden collection. Backups export an empty array. Campaign Brain receives only `gmailConnected` / last-sync freshness. Disconnect/mismatch clears tokens.

## 28. Campaign Brain

`sanitizeAiContext` strips secret field names, `googleSub`, and Gmail content. The AI prompt labels context as untrusted data and forbids following instructions inside it.

## 29. Logging / errors

Auth logger prints error type/code only. API 500s use generic copy. Health no longer returns filesystem/SQL messages.

## 30. Headers / CORS / cache

App-wide CSP, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy. No `Access-Control-Allow-Origin: *`. Authenticated JSON is `Cache-Control: private, no-store`. HSTS is added only when `AUTH_URL` is HTTPS.

## 31. Backup / export

Exports strip secret field names, omit Gmail messages, and scope to the current workspace. Import cannot change `googleSub` on existing operators.

## 32–33. Dependencies / supply chain

`package-lock.json` is present. Do not run `npm audit fix --force`.

### Security checkpoint

Commit `64177f4c97b27a20622780e558e7922037247fb5` (`security: harden ReGeneLuxe application boundaries`) on `origin/main`. Gmail/YouTube ingestion WIP was left unstaged.

### Signed-in live acceptance

Unauthenticated live checks after the checkpoint:

- `/api/health` 200, no secrets; `database.localHealthy=true`; `database.sync.state=SYNCED`; `cloudConfigured=true`
- Security headers present (`X-Frame-Options: DENY`, CSP, `nosniff`, `Cache-Control: no-store`)
- `/settings`, `/api/data/collection`, `/api/jobs/tick`, `/api/backup`, `/api/db/health` redirect 307 to sign-in

Signed-in UI smoke (Account Settings, DJ Coast workspace, Connections, Data & Sync, avatar, Campaigns, Content, Analytics, sign-out/in) was **not completed in this follow-up**. Google OAuth started with `openid profile email` + PKCE to `http://127.0.0.1:5174/api/auth/callback/google`, then stopped on the operator passkey/password challenge. No password was entered. No provider ingestion was started.

### Dependency remediation (follow-up)

Removed from product/test runtime:

- `react-router-dom` (and `react-router`). Product already uses native Next App Router (`nav/next.jsx` + `AppShellNext`). Vitest now uses an in-memory `MemoryRouter` in `src/nav/vite.jsx`.

Patched / overridden (minors/patches only):

| Package | Action | Runtime |
| --- | --- | --- |
| `next` | 16.3.6 (prior checkpoint) | production |
| `vite` | 7.2.x → 7.3.6 | test tooling |
| `rollup` | override 4.64.0 | test tooling (via Vite) |
| `minimatch` | override 3.1.5 | ESLint |
| `brace-expansion` | override 1.1.21 | ESLint / glob |
| `picomatch` 2.x | override 2.3.2 | Tailwind/chokidar glob |
| `picomatch` 4.x | override 4.0.7 | Vite/Vitest |
| `browserslist` | override 4.29.3 | Autoprefixer/Babel |
| `flatted` | override 3.4.4 | ESLint cache |
| `js-yaml` | override 4.3.2 | ESLint |

### Remaining HIGH advisories

All remaining High findings are **dev-only CSS tooling** pulled by Tailwind CSS 3.4 (`chokidar` → `braces` / `micromatch` / `fast-glob`). They are not shipped in the Next.js production server runtime. The npm-reported fix is Tailwind **4.3.3**, a major upgrade deferred to avoid destabilizing PostCSS/build.

| Package | Path | Prod runtime? | Safe patch? | Action |
| --- | --- | --- | --- | --- |
| `tailwindcss` 3.4.18 | direct devDependency | build-time CSS only | no (major 4.x) | defer |
| `chokidar` 3.6.0 | tailwindcss | no | only via Tailwind 4 | defer |
| `braces` | chokidar / micromatch | no | npm reports all versions | defer |
| `micromatch` | tailwindcss / fast-glob | no | only via Tailwind 4 | defer |
| `fast-glob` | tailwindcss | no | only via Tailwind 4 | defer |

**Production-reachable Highs:** 0  
**Dev-only Highs remaining:** 5 (Tailwind 3 glob stack)  
**Critical:** 0  

Post-remediation `npm audit`: 0 critical, 5 high (dev-only), 5 moderate, 2 low.

Moderates deferred (Vitest 5 major, or unused-in-runtime parsers): `vitest` / `@vitest/mocker`, `ajv`, `yaml`, `@humanfs/node`.

Install scripts present and expected: `esbuild` postinstall (native binary) and optional `fsevents` on macOS. No unexpected install scripts.

## 34. Prompt injection boundary

External email subjects, snippets, captions, and social display names are data. They must not override system instructions or invoke tools. This remains true if Gmail bodies are later considered for AI — they must stay out by default.

## 35. Local filesystem

`.regeneluxe/`, `server/.secrets.json`, `server/.secrets.key`, `*.local`, and `*.db` are gitignored. They are not served from `public/`.

## 36. Regression tests

See `server/auth/security.boundaries.test.js` plus existing identity, OAuth mismatch, origin, media, allowlist, and secret-stripping tests. Route chrome tests use the in-memory `MemoryRouter` in `src/nav/vite.jsx` (no `react-router-dom`).

Gmail/YouTube ingestion remains uncommitted WIP and is out of scope for both security checkpoints.
