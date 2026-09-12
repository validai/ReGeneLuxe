# Modern Rails — native App Router

**Canonical:** Next.js on `http://127.0.0.1:5174/`  
**Health:** `framework: "next"`  
**SPA bridge:** removed  
**Vite product runtime:** retired (Vitest may still use Vite + react-router for screen tests)

## Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next UI + API on `127.0.0.1:5174` |
| `npm run build` | `next build` |
| `npm start` | production Next on `127.0.0.1:5174` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm test` | vitest |

Do not verify against `:3200`, `:5175`, or a standalone `:8787`.

## Architecture

- Native routes under `app/(workspace)/` — see `ROUTE_PARITY.md`
- Persistent shell via `WorkspaceProviders` + `AppShellNext`
- Same-origin `/api/*` Route Handlers
- Client data seam: `src/data/access.ts` + repositories / `useAppData` (localStorage today)
