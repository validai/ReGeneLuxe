# ReGeneLuxe design system inventory

Canonical language for the Vite SPA. Do not invent page-specific colors or button styles.

## Semantic tokens (`src/index.css` + `tailwind.config.js`)

| Token | Role |
|-------|------|
| `rl_bg` / `--rl-bg` | Application background (level 0) |
| `rl_surface` | Primary workspace (level 1) |
| `rl_surfaceRaised` | Raised panels/controls (level 2) |
| `rl_surfaceHover` / `rl_surfaceActive` | Hover / selected (level 3) |
| `rl_border` / `rl_borderStrong` | Dividers |
| `rl_text` / `rl_textSecondary` / `rl_muted` | Text hierarchy |
| `rl_accent` / `rl_accentHover` | Primary action, active nav, focus |
| `rl_ok` / `rl_warning` / `rl_danger` / `rl_info` | Status |
| `rl_focus` | Focus ring |

Dark is authoritative. Light theme remaps the same semantics via `[data-theme="light"]`.

## Typography

| Role | Implementation |
|------|----------------|
| Display / page title | `font-display` (Fraunces) via `PageHeader` |
| Section / label | `.rl-label` |
| Body | `font-sans` (IBM Plex Sans) |
| Meta | `.rl-meta` |
| Section title | `.rl-section-title` |

## Buttons (CSS utilities — no per-page variants)

- `.rl-btn` — primary (rare)
- `.rl-btn-ghost` — secondary
- `.rl-btn-danger` — destructive
- `.rl-btn-icon` — icon-only

## Shared components (`src/components/app/`)

| Component | Use |
|-----------|-----|
| `AppShell` | Global nav, Create, account, collapse |
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

Gold/tan accent for primary action, active nav, selection, and key recommendations only — not every border or heading.
