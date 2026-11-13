# Provider certification mission (TEST only)

## Authorization boundary

Controlled real provider testing is authorized **only** in the alternate-artist **TEST** workspace.

- Workspace: **S!xd9** (`de5d366a-393f-4f30-a4f3-5d9b397a4340`) · purpose `TEST` · operator `sixd9music@gmail.com`
- **DJ Coast** (`ffaed2b8-…` / `dj-coast`) provider writes are **hard-blocked**
- Non-TEST writes blocked unless `REGENELUXE_ALLOW_PRODUCTION_PROVIDER_WRITES=1` after explicit promotion

## What Cursor can self-run

| Step | Status |
|------|--------|
| Designate S!xd9 as TEST | Done (`npm run cert:mission`) |
| Synthetic cert campaign + drafts | Done |
| Synthetic media asset | Done (local `/api/media/…`) |
| Dry-run scheduled dispatch | Done — blocked on missing TEST destinations (expected) |
| DJ Coast write guard proof | Done |
| Live OAuth connect | **Operator** (Google/Meta/etc browser security) |
| One harmless live post per provider | Cursor after TEST accounts connect |
| Verify/readback | Cursor after live post |
| Delete/archive provider post | Manual / provider tools until DELETE_CONTENT exists |

## Operator-only steps (cannot automate)

1. Sign in at http://localhost:5174 as **sixd9music@gmail.com** (S!xd9).
2. Open **Settings → Connections**.
3. Connect Instagram / Facebook / YouTube (and any other publish targets) for **this artist only**.
4. Complete Google/Meta (etc.) passkeys, 2FA, and consent screens.
5. Do **not** connect or publish using DJ Coast destinations for this mission.
6. Tell Cursor when TEST accounts show `CONNECTED`.

## Cursor resume command

```bash
npm run cert:mission
```

Then continue live slice: one `[REGENELUXE CERT]` post per connected publish-capable provider → verify → record controlled real test → cleanup where safe.

## Honest certification state

Current: `REGENELUXE_PROVIDER_CERT_BLOCKED_AWAITING_TEST_OAUTH`
