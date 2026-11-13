/**
 * In-process job ticker observability (no secrets).
 * State lives on globalThis so instrumentation and route handlers share one copy
 * under Next.js module graph duplication.
 */

const GLOBAL_KEY = "__rlJobTickerState";

function state() {
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = {
      enabled: false,
      startedAt: null,
      intervalMs: null,
      lastTickAt: null,
      lastTickOk: null,
      lastError: null,
      lastDurationMs: null,
      tickCount: 0,
      skippedOverlap: 0,
      inFlight: false,
    };
  }
  return globalThis[GLOBAL_KEY];
}

export function markTickerStarted({ intervalMs } = {}) {
  const s = state();
  s.enabled = true;
  s.startedAt = new Date().toISOString();
  s.intervalMs = intervalMs ?? null;
}

export function markTickerDisabled(reason = "disabled") {
  const s = state();
  s.enabled = false;
  s.lastError = reason;
}

export function beginTick() {
  const s = state();
  if (s.inFlight) {
    s.skippedOverlap += 1;
    return false;
  }
  s.inFlight = true;
  return true;
}

export function endTick({ ok, error = null, durationMs = null } = {}) {
  const s = state();
  s.inFlight = false;
  s.tickCount += 1;
  s.lastTickAt = new Date().toISOString();
  s.lastTickOk = Boolean(ok);
  s.lastDurationMs = durationMs;
  s.lastError = ok ? null : sanitizeTickerError(error);
}

function sanitizeTickerError(error) {
  if (!error) return "unknown_error";
  const msg = error instanceof Error ? error.message : String(error);
  return msg.slice(0, 240).replace(/(sk-|Bearer\s+)\S+/gi, "[redacted]");
}

export function getTickerHealth() {
  const s = state();
  return {
    enabled: s.enabled,
    startedAt: s.startedAt,
    intervalMs: s.intervalMs,
    lastTickAt: s.lastTickAt,
    lastTickOk: s.lastTickOk,
    lastError: s.lastError,
    lastDurationMs: s.lastDurationMs,
    tickCount: s.tickCount,
    skippedOverlap: s.skippedOverlap,
    inFlight: s.inFlight,
  };
}

/** Test-only reset. */
export function resetTickerStateForTests() {
  globalThis[GLOBAL_KEY] = {
    enabled: false,
    startedAt: null,
    intervalMs: null,
    lastTickAt: null,
    lastTickOk: null,
    lastError: null,
    lastDurationMs: null,
    tickCount: 0,
    skippedOverlap: 0,
    inFlight: false,
  };
}
