"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShellNext from "./AppShellNext.jsx";
import CommandPaletteNext from "./CommandPaletteNext.jsx";
import { ToastProvider } from "./ToastProvider.jsx";
import ErrorBoundary from "../ErrorBoundary.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { applyTheme } from "../../data/settingsRepository.js";
import {
  bootstrapDurableStore,
  getLastSyncStatus,
  persistCollectionToSqlite,
} from "../../data/durableBootstrap.js";

/**
 * Native App Router chrome: shell, toasts, theme, command palette, shortcuts.
 * Boots local SQLite migration/dual-write without blocking first paint.
 */
export default function WorkspaceProviders({ children }) {
  const { settings } = useAppData();
  const [commandOpen, setCommandOpen] = useState(false);
  const [syncBanner, setSyncBanner] = useState(null);
  const router = useRouter();

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.__rlPersistCollection = persistCollectionToSqlite;
    }
    let cancelled = false;
    bootstrapDurableStore().then((result) => {
      if (cancelled) return;
      const sync = result?.sync || getLastSyncStatus();
      if (sync && sync.cloudConfigured && (sync.state === "PENDING" || sync.pendingOutbox > 0)) {
        setSyncBanner("Cloud sync pending");
      } else if (sync && sync.cloudConfigured && (sync.state === "ERROR" || sync.state === "Offline")) {
        setSyncBanner("Cloud sync offline — working locally");
      } else {
        setSyncBanner(null);
      }
    });
    // Durable job worker tick — non-blocking; continues when providers/cloud/AI fail.
    const tick = () => {
      fetch("/api/jobs/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 3 }),
      }).catch(() => {});
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let goPending = false;
    let goTimer;

    const onKey = (event) => {
      const target = event.target;
      const typing = target && (
        target.tagName === "INPUT"
        || target.tagName === "TEXTAREA"
        || target.tagName === "SELECT"
        || target.isContentEditable
      );

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (typing) return;

      if (goPending) {
        const key = event.key.toLowerCase();
        goPending = false;
        clearTimeout(goTimer);
        if (key === "c") {
          event.preventDefault();
          router.push("/calendar");
          return;
        }
        if (key === "a") {
          event.preventDefault();
          router.push("/analytics");
          return;
        }
        if (key === "d") {
          event.preventDefault();
          router.push("/");
          return;
        }
        if (key === "i") {
          event.preventDefault();
          router.push("/inbox");
          return;
        }
      }

      if (event.key.toLowerCase() === "g" && !event.metaKey && !event.ctrlKey) {
        goPending = true;
        clearTimeout(goTimer);
        goTimer = setTimeout(() => { goPending = false; }, 800);
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setCommandOpen(true);
        return;
      }

      if (event.key.toLowerCase() === "c" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        router.push("/content/new");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(goTimer);
    };
  }, [router]);

  return (
    <ErrorBoundary>
      <ToastProvider>
        <div className="min-h-screen bg-rl_bg text-rl_text">
          {syncBanner ? (
            <div
              className="border-b border-rl_border bg-rl_surface px-4 py-1.5 text-center text-[11px] uppercase tracking-[0.14em] text-rl_muted"
              role="status"
            >
              {syncBanner}
            </div>
          ) : null}
          <AppShellNext onOpenCommand={() => setCommandOpen(true)}>
            {children}
          </AppShellNext>
          {commandOpen ? (
            <CommandPaletteNext key="command-open" open onClose={() => setCommandOpen(false)} />
          ) : null}
        </div>
      </ToastProvider>
    </ErrorBoundary>
  );
}
