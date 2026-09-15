/**
 * Data access seam for repository-backed / synced storage.
 *
 * Product authority (after boot):
 *   UI repositories → operationalStore (memory) → SQLite via /api → Turso outbox
 *
 * Test harness (Vitest):
 *   localStorage only — no Next API required
 *
 * UI preferences (sidebar/view) stay in localStorage always.
 */

export const DATA_BACKEND = "sqlite" as const;

export type DataBackend = "localStorage" | "sqlite" | "memory";

/** Vitest / unit tests without Next server. */
export function isTestHarness(): boolean {
  if (typeof process !== "undefined" && (process.env.VITEST || process.env.NODE_ENV === "test")) {
    return true;
  }
  return false;
}
