/**
 * Data access seam for repository-backed / synced storage.
 *
 * Product path: UI repositories → localStorage mirror (sync UX) + dual-write to
 * local SQLite via `/api/*` (`server/db`). Optional Turso Cloud via outbox sync.
 *
 * Backends:
 * - `localStorage` — browser mirror / Vitest harness / rollback window
 * - `sqlite` — durable local DB (`.regeneluxe/local.db`)
 * - `memory` — in-process `:memory:` libSQL (`RL_DB_MODE=memory` / tests)
 */
export const DATA_BACKEND = "sqlite" as const;

export type DataBackend = "localStorage" | "sqlite" | "memory";
