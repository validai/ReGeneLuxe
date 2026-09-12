# Sprint 84 — Pixel / quality checklist

Flagship surfaces reviewed against design-system.md (dark theme).

## Checklist

- [x] Design tokens documented (`src/design-system.md`)
- [x] AppShell: skip link, SVG nav, collapse, Create, account selector
- [x] Dashboard: Today / Needs you / Recommends / Campaigns / Performance / Upcoming
- [x] Calendar: Month/Week/List, preview sheet, DnD reschedule
- [x] Content: status buckets, list/grid, preview sheet
- [x] Composer: accounts, variants, media notes, local helpers, preview
- [x] Campaign Overview: ReGeneLuxe sees / Next / Attention / Performance
- [x] Strategy: summary → essentials edit → show all sections
- [x] Analytics: what changed → metrics → top content → interpretation
- [x] Inbox: list + detail + reply helpers
- [x] Accounts: essentials + More details disclosure
- [x] AttentionCenter + ApprovalSheet shared
- [x] Lazy routes + Skeleton fallback
- [x] Motion: fade-in / press / reduced-motion
- [x] Lint + 80 tests + production build

## Deferred (intentional)

- Real OAuth reconnect (capability honesty over fake Connected)
- Server AI in composer (local heuristics until key configured)
- Playwright visual regression suite
- Hour-grid calendar day view

## Browser gate target

Canonical: `http://127.0.0.1:5174/` + `/api/health` identity.
