# Modern Rails + Data Rails

**Canonical:** Next.js on `http://localhost:5174/`  
**Health:** `framework: "next"` + `database` block  
**SPA bridge:** removed  
**Durable store:** local SQLite (`.regeneluxe/local.db`) + optional Turso Cloud  
See `DATA_ARCHITECTURE.md` and `DATA_MIGRATION_PLAN.md`.

## Commands

| Script | Purpose |
|--------|---------|
| `npm run dev` | Next UI + API on `localhost:5174` |
| `npm run build` | `next build` |
| `npm start` | production Next; origin comes from `AUTH_URL` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | eslint |
| `npm test` | vitest |

Do not verify against `:3200`, `:5175`, or a standalone `:8787`.
