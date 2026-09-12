# Modern Rails — complete (cutover approved)

**Canonical:** Next.js on `http://127.0.0.1:5174/`  
**Health:** `framework: "next"`  
**Vite product runtime:** retired (Vitest may still use Vite tooling)

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

## Sprint status (user 85–104)

See `RECOVERY_MATRIX.md`. Cutover and hardening complete; SPA bridge preserves Stack A UI inside App Router while Route Handlers own `/api`.
