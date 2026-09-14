# ReGeneLuxe design system inventory

Canonical language for the app shell. Do not invent page-specific colors or button styles.

## Semantic tokens (`src/index.css` + `tailwind.config.js`)

Cool-neutral scale (no tan). Dark is authoritative; light remaps via `[data-theme="light"]`.

| Token | Role |
|-------|------|
| `rl_bg` / `--rl-bg` | Application background (level 0) |
| `rl_surface` | Primary workspace (level 1) |
| `rl_surfaceRaised` | Raised panels/controls (level 2) |
| `rl_surfaceHover` / `rl_surfaceActive` | Hover / selected (level 3) |
| `rl_border` / `rl_borderStrong` | Dividers |
| `rl_text` / `rl_textSecondary` / `rl_muted` | Text hierarchy |
| `rl_accent` / `rl_accentHover` | Primary action, active nav inset bar, focus |
| `rl_ok` / `rl_warning` / `rl_danger` / `rl_info` | Status |
| `rl_focus` | Focus ring |

## Typography

| Role | Implementation |
|------|----------------|
| Display / page title | `font-display` — Space Grotesk (`font-semibold tracking-tight`) |
| Body / UI | `font-sans` — Geist Sans |
| Section / label | `.rl-label` |
| Meta | `.rl-meta` |
| Section title | `.rl-section-title` |

Loaded in `app/layout.tsx` via `next/font` (Space_Grotesk) + `geist/font/sans`.

## Icons

Phosphor Icons **bold**, monochrome (`currentColor`) via `src/components/app/Icon.jsx` / `NavIcon`. Prefer icons over Unicode glyphs in chrome (close, back, nav).

## Mark / favicon

Geometric **R** monogram (thick stem + top/mid crossbars). Assets: `public/icon.svg`, `icon-light.svg`, `icon-dark.svg`; Next `app/icon.tsx` + `app/apple-icon.tsx`; `public/site.webmanifest`.

## Buttons (CSS utilities — no per-page variants)

- `.rl-btn` — primary (rare)
- `.rl-btn-ghost` — secondary
- `.rl-btn-danger` — destructive
- `.rl-btn-icon` — icon-only

## Shared components (`src/components/app/`)

| Component | Use |
|-----------|-----|
| `AppShell` / `AppShellNext` | Global nav, Create, account, collapse |
| `PageShell` / `PageHeader` | Page frame |
| `FilterBar` | Shared filters + clear |
| `SegmentedControl` / `Tabs` | View switching |
| `StatusBadge` | Content/campaign/connection states |
| `SideSheet` | Quick inspect/edit |
| `ConfirmDialog` | Destructive/critical confirm |
| `ToastProvider` / `useToast` | Transient feedback |
| `EmptyState` / `ErrorState` / `Skeleton` | Empty, error, loading |
| `AttentionItem` / `NextBestAction` / `ApprovalSheet` | Operational attention |
| `MetricCard` | Restrained metrics |
| `CommandPalette` | ⌘K navigation |
| `FormField` | Labeled inputs |

## Page map

Dashboard · Calendar · Content · Campaigns · Inbox · Analytics · Accounts (+ Queue, Settings secondary).

## Accent discipline

Neutral accent for primary action, active nav inset, selection, and key recommendations only — not every border or heading. Do not introduce a colorful accent palette.
