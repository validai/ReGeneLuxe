# Recovery matrix — final (cutover approved)

## Stack A — UI/UX 65–84: COMPLETE

## Stack B — Modern Rails 85–104: COMPLETE (cutover)

Canonical Next.js at `http://127.0.0.1:5174/`.

| Sprint | Status |
|--------|--------|
| 85–100 | COMPLETE |
| 101 Old stack removal | COMPLETE for product path — `dev:vite` / `build:vite` / `preview` / `dev:runtime` scripts removed; Vite kept only as Vitest dependency |
| 102 Cutover | COMPLETE |
| 103 UI regression | COMPLETE against Next :5174 |
| 104 Final verification | Gate below |

## Retired (do not use)

- Port `3200` (old Next preview)
- Port `5175` (Vite port hop)
- Standalone `8787` as product API
- `npm run dev:vite`

## Preserved

- Browser `localStorage` operator data
- SPA UI via `app/ClientSpa` + `SpaBridge`
- `react-router-dom` inside SPA bridge (client-only)
- Vitest + Vite as **test** tooling only
