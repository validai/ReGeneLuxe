/**
 * Node-only runtime registration (imported only when NEXT_RUNTIME === "nodejs").
 */
import { appendLifecycleEvent } from "./lifecycleLog.js";
import { markTickerStarted, markTickerDisabled, beginTick, endTick } from "./jobTickerState.js";

export async function registerNodeRuntime() {
  const gitSha = process.env.RL_RUNTIME_GIT_SHA || null;
  appendLifecycleEvent({
    type: "startup",
    mode: process.env.NODE_ENV || "unknown",
    port: Number(process.env.PORT || process.env.REGENELUXE_UI_PORT || 5174),
    gitSha,
  });

  installExitObservability();

  if (process.env.RL_DISABLE_JOB_TICKER === "1") {
    markTickerDisabled("RL_DISABLE_JOB_TICKER");
    return;
  }
  if (process.env.VITEST === "true" || process.env.NODE_ENV === "test") {
    markTickerDisabled("test");
    return;
  }
  if (globalThis.__rlJobTickerStarted) return;
  globalThis.__rlJobTickerStarted = true;

  const intervalMs = Number(process.env.RL_JOB_TICKER_MS || 15_000);
  const safeInterval = Number.isFinite(intervalMs) && intervalMs >= 5_000 ? intervalMs : 15_000;
  markTickerStarted({ intervalMs: safeInterval });

  const tick = async () => {
    if (!beginTick()) return;
    const started = Date.now();
    try {
      const { processJobQueue } = await import("../jobs/worker.js");
      const { reconcileMarketingPublishJobs } = await import("../marketingDrafts/scheduleBridge.js");
      await reconcileMarketingPublishJobs({ limit: 20 }).catch((error) => {
        console.error("[regeneluxe-job-ticker] reconcile", error instanceof Error ? error.message : error);
      });
      await processJobQueue({ limit: 5 });
      endTick({ ok: true, durationMs: Date.now() - started });
    } catch (error) {
      endTick({ ok: false, error, durationMs: Date.now() - started });
      console.error("[regeneluxe-job-ticker]", error instanceof Error ? error.message : error);
    }
  };

  const timer = setInterval(tick, safeInterval);
  if (typeof timer === "object" && typeof timer.unref === "function") timer.unref();
  const boot = setTimeout(tick, 3_000);
  if (typeof boot === "object" && typeof boot.unref === "function") boot.unref();
  globalThis.__rlJobTickerTimer = timer;
}

function installExitObservability() {
  if (globalThis.__rlExitObsInstalled) return;
  globalThis.__rlExitObsInstalled = true;

  const onSignal = (signal) => {
    appendLifecycleEvent({ type: "shutdown_signal", signal });
  };
  process.on("SIGTERM", () => onSignal("SIGTERM"));
  process.on("SIGINT", () => onSignal("SIGINT"));

  process.on("uncaughtException", (error) => {
    appendLifecycleEvent({
      type: "fatal_uncaughtException",
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? (error.stack || "").split("\n").slice(0, 8).join("\n") : null,
    });
    console.error("[regeneluxe-runtime] uncaughtException", error);
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    appendLifecycleEvent({
      type: "fatal_unhandledRejection",
      error: message,
      stack: reason instanceof Error ? (reason.stack || "").split("\n").slice(0, 8).join("\n") : null,
    });
    console.error("[regeneluxe-runtime] unhandledRejection", message);
  });

  process.on("exit", (code) => {
    appendLifecycleEvent({ type: "process_exit", exitCode: code });
  });
}
