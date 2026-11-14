# Provider certification mission (TEST only)

## Operator-path self-certification (permanent)

| Field | Value |
|-------|--------|
| `OPERATOR_PATH_SELF_CERTIFIED` | **YES** for YouTube scope-truth + mocked upgrade path (`npm run test:e2e-youtube-scope`) |
| Live upload grant on S!xd9 | **NO** (`youtube.upload` absent) |

**Rule:** No operator OAuth instructions when `OPERATOR_PATH_SELF_CERTIFIED = NO` for that path.

The operator is never the first tester.

## Authorization boundary

- Workspace: **S!xd9** (`de5d366a-393f-4f30-a4f3-5d9b397a4340`) · purpose `TEST` · `sixd9music@gmail.com`
- **DJ Coast** provider writes hard-blocked
- No provider writes until Cursor verifies a successful credential result after any operator OAuth step

## Live S!xd9 connection truth (re-inspected)

| Surface | State |
|---------|--------|
| Gmail | CONNECTED |
| YouTube | CONNECTED · **Read only** (vault scopes) |
| Instagram / Facebook / TikTok / LinkedIn | NOT CONNECTED |

### ACTUAL_GRANTED_SCOPES (Settings YouTube vault `youtube::11e3e906-…`)

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

**`https://www.googleapis.com/auth/youtube.upload` is NOT present.**

### Classification

| Class | State |
|-------|--------|
| IDENTITY_CONNECTED | YES |
| READ_CONNECTED | YES |
| UPLOAD_SCOPE_PRESENT | NO |
| PUBLISH_IMPLEMENTED | YES (code) |
| PUBLISH_CAPABLE | NO |
| SCHEDULE_CAPABLE | NO |
| CERTIFIED | NO |

## Root cause of contradictory UI (fixed)

| Surface | Was reading | Bug |
|---------|-------------|-----|
| Settings → Permission | **Hardcoded** `"Read only"` | Never read vault scopes |
| Certification → Publish | `publishImplemented` (code exists) | Labeled as Publish; collapsed with credential capability |
| Vault lookup | Social `account.id` only | Settings tokens live on **profile connection id** |
| Identity | `externalAccountId` only | YouTube rows often store `providerAccountId` |
| Settings OAuth callback | Always wrote `permission: "readonly"` | Ignored actual granted scopes |
| `/settings?youtube=connected` | Settings OAuth path | That path requests **readonly only** — never upload |

Truth model now separates: `PUBLISH_IMPLEMENTED` · `UPLOAD_SCOPE_PRESENT` · `PUBLISH_CAPABLE` · `CERTIFIED`.

Both Settings and Certification derive permission / publish-capable from the same vault scope helper.

## Why Ready stays NO

Even after upload scope exists: `CONTROLLED_REAL_TEST_PENDING` (and any other blockers). Ready ≠ Certified. No provider write yet.

## Self-certified upgrade path (mocked ×3)

`npm run test:e2e-youtube-scope`

Proves: Settings beginAuth omits upload · Accounts/`includeUpload` requests upload · callback merges scopes · vault retains upload · Settings + Certification agree · reload consistent · channel retained · not GREEN without controlled real test.

## Exact next operator action (ONE step only — after self-cert)

Upload is still missing on the live credential. After Cursor’s self-cert above:

1. Stay on S!xd9 as Six D.
2. Open **Accounts → Connect YouTube** (not Settings → Reconnect).
3. Complete the single Google consent that adds `youtube.upload` on the **same** channel `@sixd9`.
4. Stop. Tell Cursor.

Cursor will immediately inspect vault scopes and report success/failure. **Do not retry blindly** if it fails — Cursor diagnoses.

Do **not** use Settings → Reconnect YouTube for upload (readonly-only route).

## Remaining providers (after YouTube upload verified)

1. Instagram  
2. Facebook (Meta flow as required)  
3. TikTok identity (posting capability separate)

## Honest state

`REGENELUXE_YOUTUBE_SCOPE_TRUTH_RESOLVED`  
`OPERATOR_PATH_SELF_CERTIFICATION_ENFORCED`  
Live grant still awaiting one Accounts upload consent: `REGENELUXE_PROVIDER_CERT_BLOCKED_AWAITING_YOUTUBE_UPLOAD_SCOPE`
