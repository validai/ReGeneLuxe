# ReGeneLuxe — 48-hour release certification war room

**Freeze:** no side features · no agent transport · no Campaign Brain · no cosmetic UI · no new architecture unless a real test proves it necessary.

**Mission:** CONNECT → CERTIFY → BREAK → HARDEN → GREEN (release-critical providers only)

**Workspace:** S!xd9 (`de5d366a-393f-4f30-a4f3-5d9b397a4340`) · TEST  
**DJ Coast:** production write hard-blocked  
**HEAD at board open:** `b49165e`

## Mission board

| Provider/System | Current State | Blocker | Owner | Next Action |
|---|---|---|---|---|
| Runtime | LIVE OK · 5174 · ReGeneLuxe | — | Cursor | Keep canonical; no lifecycle polish |
| S!xd9 | TEST designated | — | — | Stay on this workspace only |
| YouTube | IDENTITY+READ+ANALYTICS · upload **ABSENT** · CERTIFIED=NO | `youtube.upload` missing | **Operator (ONE OAuth)** then Cursor inspect | Accounts → Connect YouTube → same `@sixd9` → STOP |
| Facebook | NOT CONNECTED | After YouTube GREEN or hard blocker | — | Do not start yet |
| Instagram | NOT CONNECTED | After Facebook; public media must be READY first | — | Do not start yet |
| TikTok | NOT CONNECTED | Identity later; posting may be BLOCKED_EXTERNAL | — | Do not start yet |
| Draft import | IMPLEMENTED (JSON path OK for war room) | — | Cursor | Use structured JSON only; no remote Grok |
| Approval | IMPLEMENTED | Needs TEST items | Cursor | After upload scope |
| Scheduler | IMPLEMENTED | Needs approved scheduled item | Cursor | After upload scope |
| Provider dispatch | IMPLEMENTED | YouTube not PUBLISH_CAPABLE | Cursor | After upload scope |
| Result recording | IMPLEMENTED | No live cert run yet | Cursor | During YT cert |
| Readback | IMPLEMENTED (API) | No live cert run yet | Cursor | During YT cert |
| Duplicate protection | IMPLEMENTED (tests) | Live cert not proven | Cursor | Break/harden after first live success |
| Restart recovery | IMPLEMENTED (fixtures) | Live cert not proven | Cursor | After happy path |
| DJ Coast production guard | LIVE hard-block | — | Cursor | Never lift in this sprint |

## YouTube scope truth (live inspect)

```
openid
userinfo.email / userinfo.profile
youtube.readonly
yt-analytics.readonly
```

`youtube.upload` = **NOT PRESENT**  
Channel identity: `UCYidjTSc8KzJYRnB3PvVDdQ` · `@sixd9` · S!XD9

`OPERATOR_PATH_SELF_CERTIFIED` (Accounts upload path) = YES (`npm run test:e2e-youtube-scope` ×3)

## Operator OAuth (ONE attempt authorized)

1. S!xd9 → **Accounts** → Connect YouTube  
2. Same Six D Google identity · same `@sixd9`  
3. Grant upload · **STOP**  
4. Tell Cursor — Cursor inspects vault (no blind retry)

Do **not** use Settings → Reconnect YouTube.

## Post-callback Cursor command

```bash
npm run cert:youtube-inspect
```

Then, only if upload present: begin PRIVATE cert upload path.

## Status line

`REGENELUXE_48H_CERT_STATUS: AWAITING_OPERATOR_YOUTUBE_UPLOAD_OAUTH`
