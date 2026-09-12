/**
 * Sprint 100 — central timed-job registry.
 *
 * Grep of `src/` (2026-09-08): no `setInterval` usages found.
 * Existing timers are one-shot `setTimeout` (debounce / toast dismiss / nav
 * guard) — not publish or monitor intervals. Do not invent fake publish timers.
 *
 * Use register/unregister when a recurring job is introduced later.
 */

export type ScheduledJob = {
  id: string;
  intervalMs: number;
  handle: ReturnType<typeof setInterval> | null;
  fn: () => void;
};

const jobs = new Map<string, ScheduledJob>();

export function register(
  id: string,
  fn: () => void,
  intervalMs: number,
): ScheduledJob {
  if (!id) throw new Error("scheduler.register requires an id");
  if (typeof fn !== "function") throw new Error("scheduler.register requires a function");
  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error("scheduler.register requires a positive intervalMs");
  }

  unregister(id);

  const handle = setInterval(fn, intervalMs);
  const job: ScheduledJob = { id, intervalMs, handle, fn };
  jobs.set(id, job);
  return job;
}

export function unregister(id: string): boolean {
  const existing = jobs.get(id);
  if (!existing) return false;
  if (existing.handle != null) clearInterval(existing.handle);
  jobs.delete(id);
  return true;
}

export function listJobs(): ReadonlyArray<Omit<ScheduledJob, "fn" | "handle"> & { running: boolean }> {
  return [...jobs.values()].map(({ id, intervalMs, handle }) => ({
    id,
    intervalMs,
    running: handle != null,
  }));
}

export function clearAll(): void {
  for (const id of [...jobs.keys()]) unregister(id);
}
