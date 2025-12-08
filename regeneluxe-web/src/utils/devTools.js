// FILE: src/utils/devTools.js
import { Auth } from "./auth";
import { Onboarding } from "./onboarding";
import { Drafts } from "./drafts";
import { Analytics } from "./analytics";

export function installDevTools() {
  if (typeof window === "undefined") return;

  // Only install in dev builds
  if (!import.meta.env.DEV) return;

  if (window.__rl_dev_installed) return;
  window.__rl_dev_installed = true;

  const api = {
    /**
     * Snapshot of current auth / onboarding / draft / analytics state.
     */
    state() {
      try {
        const authSnapshot = Auth.snapshot ? Auth.snapshot() : {};
        const email = Auth.user();
        const onboarded = email ? Onboarding.isDone(email) : false;
        const draft = Drafts.load ? Drafts.load() : null;
        const logs =
          typeof window !== "undefined" && Array.isArray(window.__rl_logs)
            ? window.__rl_logs.slice()
            : [];

        return {
          auth: authSnapshot,
          email,
          onboarded,
          hasDraft: !!draft,
          draftStep: draft && typeof draft.step === "number" ? draft.step : null,
          logCount: logs.length,
        };
      } catch (e) {
        console.error("[RL.dev] state() error", e);
        return {};
      }
    },

    /**
     * Clears auth + onboarding flag + draft for the current user (if any).
     */
    resetAll() {
      try {
        const email = Auth.user();
        if (email) {
          Onboarding.reset(email);
        }
        Auth.signOut();
        Drafts.clear(email);
        console.log("[RL.dev] resetAll done for", email || "(no email)");
      } catch (e) {
        console.error("[RL.dev] resetAll error", e);
      }
    },

    /**
     * Only clear the draft, leave auth/onboarding alone.
     */
    clearDraft() {
      try {
        const email = Auth.user();
        Drafts.clear(email);
        console.log("[RL.dev] clearDraft done for", email || "(no email)");
      } catch (e) {
        console.error("[RL.dev] clearDraft error", e);
      }
    },

    /**
     * Returns and clears the in-memory analytics buffer.
     */
    flushAnalytics() {
      try {
        const flushed = Analytics.flush ? Analytics.flush() : [];
        console.log("[RL.dev] flushAnalytics count:", flushed.length);
        return flushed;
      } catch (e) {
        console.error("[RL.dev] flushAnalytics error", e);
        return [];
      }
    },

    /**
     * Just returns the current logs array without clearing.
     */
    logs() {
      try {
        if (typeof window === "undefined") return [];
        return Array.isArray(window.__rl_logs) ? window.__rl_logs.slice() : [];
      } catch (e) {
        console.error("[RL.dev] logs() error", e);
        return [];
      }
    },
  };

  // Expose on window
  window.RL = api;

  // Optional: emergency reset via query param ?rl_reset=1
  try {
    const url = new URL(window.location.href);
    const params = url.searchParams;
    if (params.get("rl_reset") === "1") {
      console.warn("[RL.dev] rl_reset=1 detected → running resetAll()");
      api.resetAll();
      params.delete("rl_reset");

      const cleaned =
        url.pathname + (params.toString() ? "?" + params.toString() : "");
      window.history.replaceState({}, "", cleaned);
    }
  } catch (e) {
    console.error("[RL.dev] query reset handling error", e);
  }

  console.log(
    "[RL.dev] installed. Try RL.state(), RL.resetAll(), RL.flushAnalytics(), RL.logs() in DevTools."
  );
}
