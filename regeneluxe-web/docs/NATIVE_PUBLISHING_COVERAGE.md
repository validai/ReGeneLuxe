# Maximum native publishing coverage standard

Permanent product rule. Complements `docs/LAYERED_BUILD.md` and `docs/WAR_ROOM_48H.md`.

## Goal

Not: “Can ReGeneLuxe publish one thing to each provider?”

**ReGeneLuxe supports the widest practical native publishing surface each provider officially exposes.**

Zero artificial ReGeneLuxe-side restrictions when the provider API officially permits the operation.

External provider/API restrictions stay truthful and cannot be bypassed.

## Status dimensions (never collapse)

| Dimension | Meaning |
|-----------|---------|
| `SUPPORTED_BY_PROVIDER_API` | Official provider API permits this operation (current docs/product) |
| `SUPPORTED_BY_REGENELUXE` | ReGeneLuxe adapter implements it |
| `CURRENT_CREDENTIAL_AUTHORIZED` | Live workspace grant/scopes authorize it |
| `CERTIFIED` | Controlled real TEST-workspace proof passed for **this content type** |
| `BLOCKED_EXTERNAL` | App review, policy, or provider outage — not a ReGeneLuxe code gap |

If the provider API supports something and ReGeneLuxe does not: **ENGINEERING GAP** — not a “provider limitation.”

Do not show **Publish = Yes** merely because code exists for some other content type.

## Universal content primitives

| Primitive | Maps toward |
|-----------|-------------|
| `TEXT` | FB text, LinkedIn text, X text, Threads text |
| `IMAGE` | IG feed, FB image, LinkedIn image, TikTok photo |
| `MULTI_IMAGE` / `CAROUSEL` | IG carousel, FB multi, LinkedIn multi |
| `VIDEO` | Standard video |
| `SHORT_VIDEO` | IG Reel, FB Reel, TikTok video, YT Shorts-compatible |
| `LONG_VIDEO` | YouTube long-form |
| `STORY` | IG/FB Stories where API permits |
| `DOCUMENT` | LinkedIn document |
| `ARTICLE_LINK` | FB/LinkedIn link posts |
| `POLL` | LinkedIn poll where permitted |

Provider adapters map primitives → native API. Provider-specific settings stay on the adapter.

## Shared pipeline (do not fork)

```
LOCAL ASSET → ingest once → durable asset → version → platform variants
→ draft → approval → authoritative schedule → eligibility → dispatch → result → readback
```

Same schedule/eligibility/dispatch for every publishable content type.

Native provider apps are **last resort** only when API forbids, external approval cannot arrive, or provider outage — never when ReGeneLuxe simply lacks code.

## Certification is content-type aware

One successful image post does **not** make a provider GREEN.

Example rows: IG IMAGE / CAROUSEL / REEL / STORY · FB TEXT / IMAGE / VIDEO / REEL · YT PRIVATE / UNLISTED / PUBLIC / SCHEDULED · TikTok VIDEO / PHOTO / DRAFT / DIRECT.

## 48-hour certify-first order (need-first)

1. YouTube long-form scheduled / public-capable upload (safe default private; operator-approved public/unlisted/scheduled allowed)
2. Instagram Reel
3. Instagram feed image/carousel
4. Facebook feed image/video
5. Facebook Reel
6. TikTok video if Content Posting API approval permits (`BLOCKED_EXTERNAL` otherwise)

Expand remaining types immediately after release-critical paths are GREEN. Do not sacrifice architecture for speed.

## Honest current gaps (engineering — not “provider limitation”)

Living code audit (update when implementations land):

| Provider | Provider API (typical) | ReGeneLuxe today | Gap class |
|----------|------------------------|------------------|-----------|
| YouTube PRIVATE/UNLISTED/PUBLIC video | Yes | Upload helper accepts privacy; needs `youtube.upload` + cert | Credential + CERTIFIED |
| YouTube scheduled `publishAt` | Yes (private→public) | Implemented in upload helper | CERTIFIED pending |
| YouTube Shorts-compatible | Same upload API | No dedicated Shorts path/label | ENGINEERING GAP (minor) |
| YouTube thumbnail/tags/category/MFK/playlist | Partially API | Not fully wired | ENGINEERING GAP |
| Instagram IMAGE | Yes | Implemented (public media required) | Connect + media + CERT |
| Instagram CAROUSEL | Yes | Not full multi-item path | ENGINEERING GAP |
| Instagram REEL | Yes | Video path via Graph | Connect + media + CERT |
| Instagram STORY | Limited/direct API | Not claimed | Confirm API → implement or UNSUPPORTED |
| Facebook TEXT/IMAGE/VIDEO | Yes | Page post paths exist | Connect + CERT |
| Facebook REEL/STORY | Partial | Partial / verify | Audit → GAP or BLOCKED_EXTERNAL |
| TikTok direct post | Requires approved Content Posting API | Connect-only; publish unavailable | BLOCKED_EXTERNAL until approval |
| LinkedIn post types | Partner/product dependent | Connect OIDC; publish unavailable | ENGINEERING GAP / product access |
| X write | tweet.write etc. | Read-focused connect | ENGINEERING GAP / product access |

Machine-readable companion: `server/certification/publishingCoverageMatrix.js`.
