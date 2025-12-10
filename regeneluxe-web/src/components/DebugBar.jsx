// FILE: src/components/DebugBar.jsx
import React, { useEffect, useState } from "react";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";

const isDev = import.meta.env.DEV;

/**
 * DebugBar
 *
 * - Dev-only floating pill at the bottom of the screen.
 * - Shows current auth/onboarding state and analytics log count.
 * - Provides quick actions for refreshing state, clearing session, dumping logs, and reloading.
 *
 * NOTE: This component is a visual helper only; the heavier dev helpers live in window.RL
 * via utils/devTools.js. In production builds (import.meta.env.DEV === false), this
 * component renders null and has zero runtime cost.
 */
export default function DebugBar() {
  if (!isDev) return null;

  const [state, setState] = useState({
    email: null,
    authed: false,
    onboarded: false,
    logCount: 0,
  });

  const refresh = () => {
    try {
      const email = Auth.user();
      const authed = Auth.isSignedIn();
      const onboarded = email ? Onboarding.isDone(email) : false;
      const logCount =
        typeof window !== "undefined" && Array.isArray(window.__rl_logs)
          ? window.__rl_logs.length
          : 0;

      setState({ email, authed, onboarded, logCount });
    } catch (e) {
      // Fail quietly; this is a dev helper only.
      // eslint-disable-next-line no-console
      console.error("[DebugBar] refresh error", e);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const clearAuthAndOnboarding = () => {
    try {
      const email = Auth.user();
      Auth.signOut();
      if (email) {
        // We DO NOT clear onboarding here; we only clear auth.
        // If you truly need to reset onboarding for testing, use window.RL.resetAll().
        Analytics.event("debugbar_clear_session", { email });
      }
      refresh();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[DebugBar] clearAuthAndOnboarding error", e);
    }
  };

  const dumpLogs = () => {
    try {
      if (typeof window === "undefined") return;
      const logs = window.__rl_logs || [];
      // eslint-disable-next-line no-console
      console.log("[DebugBar] window.__rl_logs dump (count:", logs.length, ")");
      // eslint-disable-next-line no-console
      console.table(logs);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[DebugBar] dumpLogs error", e);
    }
  };

  const hardReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[9999] -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-black/85 px-4 py-2 text-[10px] font-medium text-white shadow-rl_soft backdrop-blur">
        <span className="uppercase tracking-[0.16em] text-amber-300">
          Dev debug
        </span>
        <span className="text-[10px] text-zinc-200">
          {state.authed ? "Signed in" : "Signed out"}
          {state.email ? ` · ${state.email}` : ""}
          {state.onboarded ? " · Onboarded" : " · Not onboarded"}
          {" · Logs:"} {state.logCount}
          {" · RL.dev ready"}
        </span>

        <button
          type="button"
          onClick={refresh}
          className="rounded-full bg-zinc-800 px-2 py-1 text-[9px] uppercase tracking-[0.16em] hover:bg-zinc-700"
        >
          Refresh
        </button>

        <button
          type="button"
          onClick={clearAuthAndOnboarding}
          className="rounded-full bg-zinc-800 px-2 py-1 text-[9px] uppercase tracking-[0.16em] hover:bg-rose-600"
        >
          Clear session
        </button>

        <button
          type="button"
          onClick={dumpLogs}
          className="rounded-full bg-zinc-800 px-2 py-1 text-[9px] uppercase tracking-[0.16em] hover:bg-emerald-600"
        >
          Dump logs
        </button>

        <button
          type="button"
          onClick={hardReload}
          className="rounded-full bg-zinc-800 px-2 py-1 text-[9px] uppercase tracking-[0.16em] hover:bg-zinc-600"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
