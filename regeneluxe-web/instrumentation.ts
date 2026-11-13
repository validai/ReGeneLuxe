/**
 * Local-first autonomous job processing for scheduled publishing.
 *
 * Strategy: in-process interval ticker inside the Next.js Node runtime.
 * - Starts once per server process (dev + next start).
 * - Calls processJobQueue on a modest interval (no tight poll).
 * - Fail-closed: errors are logged; ticker continues.
 * - Does not depend on browser, operator, or external-agent sessions.
 * - Manual /api/jobs/tick remains available for diagnostics.
 *
 * Disable with RL_DISABLE_JOB_TICKER=1.
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.RL_DISABLE_JOB_TICKER === "1") return;
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") return;
  if ((globalThis as { __rlJobTickerStarted?: boolean }).__rlJobTickerStarted) return;
  (globalThis as { __rlJobTickerStarted?: boolean }).__rlJobTickerStarted = true;

  const intervalMs = Number(process.env.RL_JOB_TICKER_MS || 15_000);
  const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 5_000 ? intervalMs : 15_000;

  const tick = async () => {
    try {
      const { processJobQueue } = await import("./server/jobs/worker.js");
      const { reconcileMarketingPublishJobs } = await import("./server/marketingDrafts/scheduleBridge.js");
      await reconcileMarketingPublishJobs({ limit: 20 }).catch(() => {});
      await processJobQueue({ limit: 5 });
    } catch (error) {
      console.error("[regeneluxe-job-ticker]", error instanceof Error ? error.message : error);
    }
  };

  setInterval(tick, safeInterval);
  // Initial delayed tick so boot can finish first.
  setTimeout(tick, 3_000);
}
