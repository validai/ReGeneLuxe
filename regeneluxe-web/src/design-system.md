# ReGeneLuxe design system inventory

Canonical language for the app shell. Do not invent page-specific colors.

## Electric Intelligence (FINAL palette)

Dark is authoritative. Light = Normal mode (same accents, light graphite surfaces).

| Role | Hex | Token |
|------|-----|-------|
| App background | `#090B10` | `--bg-app` / `rl_bg` |
| Primary surface | `#141821` | `--bg-surface` / `rl_surface` |
| Primary accent | `#6C63FF` | `--accent-primary` / `rl_accent` |
| Secondary accent | `#36C5FF` | `--accent-secondary` / `rl_accentSecondary` / `rl_info` |
| Primary text | `#F7F9FC` | `--text-primary` / `rl_text` |
| Secondary text | `#A7B0C0` | `--text-secondary` / `rl_textSecondary` |
| Success | `#22D3A7` | `--success` / `rl_ok` |
| Warning | `#FBBF24` | `--warning` / `rl_warning` |
| Error | `#F87171` | `--danger` / `rl_danger` |

Derived: `--bg-surface-raised`, `--bg-hover`, `--bg-selected`, borders, accent hover/pressed, chart-1…4.

**Rules:** Indigo = action/intelligence/selection. Cyan = analytics/info. Status colors = state only. Favicon + wordmark stay **monochrome**.

## Typography

Space Grotesk (`font-display`) · Geist Sans (`font-sans`) via `app/layout.tsx`.

## Icons

Phosphor **fill** (nav) / **bold** (actions), monochrome `currentColor` via `Icon.jsx`.

## Buttons

`.rl-btn` primary indigo · `.rl-btn-secondary` · `.rl-btn-ghost` · `.rl-btn-danger` · `.rl-btn-icon`

## Shared components

`AppShell(Next)`, `PageShell`, `PageHeader`, `EmptyState`, `NextBestAction` (`.rl-intel`), etc.
