
import { Auth } from "./auth";
import { Onboarding } from "./onboarding";

const isProd = import.meta.env.PROD;

// MODE 3 SAFETY:
// - Added storage guards
// - Added session fallback
// - Hardened global error handler
// - Soft buffer overflow protection

function safeSessionStorage() {
  try {
    if (typeof window === "undefined") return false;
    window.sessionStorage.setItem("__t", "1");
    window.sessionStorage.removeItem("__t");
    return true;
  } catch {
    return false;
  }
}

// --- Session handling -------------------------------------------------------
function getSessionId() {
  if (typeof window === "undefined") return null;

  try {
    const KEY = "rl_session_id";
    let existing = window.sessionStorage.getItem(KEY);
    if (existing) return existing;

    const fresh =
      "sess_" +
      Math.random().toString(36).slice(2) +
      "_" +
      Date.now().toString(36);

    window.sessionStorage.setItem(KEY, fresh);
    return fresh;
  } catch (e) {
    return (
      "sess_fallback_" +
      Math.random().toString(36).slice(2) +
      "_" +
      Date.now().toString(36)
    );
  }
}

// --- Local buffer for inspection -------------------------------------------
function getBuffer() {
  if (typeof window === "undefined") return null;
  if (!window.__rl_logs) {
    Object.defineProperty(window, "__rl_logs", {
      value: [],
      writable: false,
      configurable: false,
      enumerable: false,
    });
  }
  return window.__rl_logs;
}

// --- Base context -----------------------------------------------------------
function baseContext(extra = {}) {
  let email = null;
  let onboarded = false;

  try {
    email = Auth.user();
    onboarded = email ? Onboarding.isDone(email) : false;
  } catch {
    // ignore
  }

  return {
    ts: new Date().toISOString(),
    env: isProd ? "prod" : "dev",
    path:
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : null,
    sessionId: getSessionId(),
    email,
    onboarded,
    ...extra,
  };
}

// --- Core writer ------------------------------------------------------------
function write(type, name, payload = {}) {
  const ctx = baseContext({ type, name, ...payload });
  const buf = getBuffer();

  if (buf) {
    buf.push(ctx);
    // Cap in-memory buffer to prevent unbounded growth
    const MAX = 500;
    if (buf.length > MAX) {
      // Directly update window.__rl_logs since we can't reassign buf
      const trimmed = buf.slice(-MAX);
      window.__rl_logs.length = 0;
      window.__rl_logs.push(...trimmed);
    }
  }

  if (type === "error") {
    console.error("[RL][error]", name, ctx);
  } else if (type === "event") {
    console.log("[RL][event]", name, ctx);
  } else if (type === "page") {
    console.log("[RL][page]", name, ctx);
  } else {
    console.log("[RL][log]", name, ctx);
  }
}

export const Analytics = {
  page(name, payload = {}) {
    write("page", name, payload);
  },

  event(name, payload = {}) {
    write("event", name, payload);
  },

  error(name, payload = {}) {
    write("error", name, payload);
  },

  log(name, payload = {}) {
    write("log", name, payload);
  },

  /**
   * Flush and clear the in-memory log buffer.
   * Returns a shallow copy of all entries.
   * Safe to call from DevTools or a future backend uploader.
   */
  flush() {
    const buf = getBuffer();
    // Nothing to flush
    if (!buf || !Array.isArray(buf) || buf.length === 0) {
      return [];
    }
    // Respect MAX but do NOT mutate the original buffer reference
    const MAX = 500;
    const trimmed = buf.length > MAX ? buf.slice(-MAX) : buf.slice();
    // Clear the in-memory buffer so future calls only see new entries
    if (typeof window !== "undefined" && Array.isArray(window.__rl_logs)) {
      window.__rl_logs.length = 0;
    }
    return trimmed;
  },

  installGlobalErrorHandlers() {
    if (typeof window === "undefined") return;
    if (window.__rl_errorsInstalled) return;
    window.__rl_errorsInstalled = true;

    window.addEventListener("error", (event) => {
      try {
        write("error", "window_error", {
          message: event.message,
          source: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack || null,
        });
      } catch {
        // ignore
      }
    });

    window.addEventListener("unhandledrejection", (event) => {
      try {
        const reason = event.reason;
        write("error", "unhandled_rejection", {
          message:
            (reason && reason.message) ||
            (typeof reason === "string" ? reason : null),
          stack: reason && reason.stack ? reason.stack : null,
          rawType:
            reason && reason.constructor ? reason.constructor.name : typeof reason,
        });
      } catch {
        // ignore
      }
    });
  },
};

