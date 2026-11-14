# Provider certification mission (TEST only)

## Authorization boundary

Controlled real provider testing is authorized **only** in the alternate-artist **TEST** workspace.

- Workspace: **S!xd9** (`de5d366a-393f-4f30-a4f3-5d9b397a4340`) · purpose `TEST` · operator `sixd9music@gmail.com`
- **DJ Coast** (`ffaed2b8-…` / `dj-coast`) provider writes are **hard-blocked**
- Non-TEST writes blocked unless `REGENELUXE_ALLOW_PRODUCTION_PROVIDER_WRITES=1` after explicit promotion

## Live TEST connection truth (inspected)

Do **not** treat older “zero connected accounts” / YouTube `MISSING_DESTINATION` notes as current.

| Surface | State |
|---------|--------|
| Gmail | CONNECTED (Settings profile connection) |
| YouTube | CONNECTED + READ ONLY (Settings profile connection) |
| Authorized Google identity | Six D (`sixd9music@gmail.com`) |
| Instagram | NOT CONNECTED |
| Facebook | NOT CONNECTED |
| TikTok | NOT CONNECTED |
| LinkedIn | NOT CONNECTED |

Social publish destinations in S!xd9: YouTube account row `@sixd9` / `UCYidjTSc8KzJYRnB3PvVDdQ` is present and `CONNECTED`. That is **identity**, not upload certification.

## YouTube classification (current)

| Class | State | Evidence |
|-------|-------|----------|
| `IDENTITY_CONNECTED` | **YES** | Channel `UCYidjTSc8KzJYRnB3PvVDdQ`, handle `@sixd9`, account + profile connection `CONNECTED` |
| `READ_CONNECTED` | **YES** | Vault grant on Settings connection id; Settings permission `readonly` |
| `UPLOAD_SCOPE_PRESENT` | **NO** | Live scopes do **not** include `youtube.upload` |
| `PUBLISH_CAPABLE` | **NO** | Upload scope absent; publish path needs account-bound tokens with upload |
| `SCHEDULE_CAPABLE` | **NO** | Code can pass `publishAt` for private→public schedule once upload works; not usable yet |
| `CERTIFIED` | **NO** | No controlled real upload/readback recorded |

### Exact scopes currently granted (S!xd9 YouTube Settings grant)

Vault key: `youtube::11e3e906-d6bb-46cd-a50b-671bcce00c08` (profile connection id — **not** the social account row id)

- `openid`
- `https://www.googleapis.com/auth/userinfo.email`
- `https://www.googleapis.com/auth/userinfo.profile`
- `https://www.googleapis.com/auth/youtube.readonly`
- `https://www.googleapis.com/auth/yt-analytics.readonly`

**Missing for publish:** `https://www.googleapis.com/auth/youtube.upload`

Do **not** reconnect YouTube from **Settings** merely to re-establish identity. Settings YouTube OAuth requests **readonly + analytics only** and will not add upload.

### Smallest safe upgrade path (upload only)

1. Stay signed in as **sixd9music@gmail.com** on S!xd9 TEST.
2. Open **Accounts** (not Settings → Reconnect YouTube).
3. Start **YouTube** connect from Accounts — that path requests pilot scopes including `youtube.upload` (`includeUpload: true`).
4. Complete Google consent for upload on the **same** Six D Google identity.
5. Confirm the **same** channel `@sixd9` / `UCYidjTSc8KzJYRnB3PvVDdQ` if prompted — do not pick a different channel.
6. Stop. No provider write yet. Tell Cursor when vault shows `youtube.upload` on the TEST YouTube destination.

Expected after success: `UPLOAD_SCOPE_PRESENT=YES`. Publish/schedule/cert still require a later controlled private cert upload (not this step).

## Remaining TEST providers (order)

1. **Instagram** — connect next (Meta / Facebook Login for Business as required).
2. **Facebook** — connect after Instagram or as the same Meta flow requires (operator picks Page; never auto-first).
3. **TikTok** — connect identity when ready; posting capability stays separate until publish support is true.

## What Cursor can self-run (so far)

| Step | Status |
|------|--------|
| Designate S!xd9 as TEST | Done |
| Synthetic cert campaign / assets | Done |
| DJ Coast write guard | Done |
| YouTube live scope inspection | Done (this update) |
| YouTube upload-scope upgrade | **Operator** — Accounts YouTube connect only |
| Instagram / Facebook / TikTok connect | **Operator** |
| One harmless live post per provider | Cursor **after** upload/connect + explicit go |
| Verify/readback | Cursor after live post |
| Delete/archive provider post | Manual / provider tools until DELETE_CONTENT exists |

## Cursor resume

```bash
npm run cert:mission
```

Re-inspect vault scopes before any write. Do not invent GREEN.

## Honest certification state

`REGENELUXE_PROVIDER_CERT_BLOCKED_AWAITING_YOUTUBE_UPLOAD_SCOPE`

(and Meta/TikTok connects still pending)
