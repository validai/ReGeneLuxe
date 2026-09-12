/**
 * Data access seam for upcoming repository-backed / synced storage.
 *
 * Today the product reads and writes through `*Repository` modules and
 * `useAppData`, backed by browser localStorage (`storage.js`).
 *
 * Do not call localStorage from screens. Keep repository APIs stable so a
 * future SQLite / cloud-synced backend can swap the implementation without
 * rewriting App Router pages.
 */
export const DATA_BACKEND = "localStorage" as const;

export type DataBackend = typeof DATA_BACKEND;
