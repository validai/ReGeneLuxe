# Visual Identity Audit — Pre-foundation

## Legacy tan dependencies (retired this sprint)

| Location | Issue |
|----------|--------|
| `src/index.css` `:root` | Warm brown RGB surfaces (`16 15 14` → `52 46 40`), tan accent `203 173 141` |
| `src/index.css` `[data-theme=light]` | Cream/sand backgrounds `243 237 228`, brown accent |
| `--accent: #CBAD8D` | Hardcoded gold/tan legacy alias |
| Google Fonts Fraunces + IBM Plex | Editorial serif + dated UI sans |
| `font-display` on PageHeader / Confirm / SideSheet | Serif page titles |
| Custom `NavGlyph` SVGs | Thin 1.5 stroke, inconsistent custom set |
| `✕` close, `←` back | Text/Unicode substitutes |
| No favicon package | Missing app mark |

## Keep unchanged

Sidebar structure, routes, page shells, IA, navigation labels, workspace geometry.

## Palette status

**Temporary cool neutrals only.** Final accent deferred to dedicated palette sprint.
Semantic tokens (`--bg-app`, `--accent-primary`, …) map centrally for one-place swap.
