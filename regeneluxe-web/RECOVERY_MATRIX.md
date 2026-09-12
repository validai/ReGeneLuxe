# Recovery matrix — final (native App Router peel)

## Stack A — UI/UX 65–84: COMPLETE

## Stack B — Modern Rails 85–104: COMPLETE (cutover)

## Native App Router peel: COMPLETE

Canonical Next.js at `http://127.0.0.1:5174/`. See `ROUTE_PARITY.md`.

| Sprint | Status |
|--------|--------|
| 85–100 | COMPLETE |
| 101 Old stack removal | COMPLETE for product path — Vite kept only as Vitest dependency |
| 102 Cutover | COMPLETE |
| 103 UI regression | COMPLETE against Next :5174 |
| 104 Final verification | COMPLETE |
| Native peel | COMPLETE — SPA bridge removed; routes under `app/(workspace)/` |

## Retired (do not use)

- Port `3200` (old Next preview)
- Port `5175` (Vite port hop)
- Standalone `8787` as product API
- `npm run dev:vite`
- `ClientSpa` / `SpaBridge` / product `BrowserRouter`

## Preserved

- Browser `localStorage` operator data
- `react-router-dom` for **Vitest** MemoryRouter harness only (`src/App.jsx`, `nav/vite.jsx`)
- Vitest + Vite as **test** tooling only
