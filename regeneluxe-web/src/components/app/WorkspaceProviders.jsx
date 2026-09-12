"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AppShellNext from "./AppShellNext.jsx";
import CommandPaletteNext from "./CommandPaletteNext.jsx";
import { ToastProvider } from "./ToastProvider.jsx";
import ErrorBoundary from "../ErrorBoundary.jsx";
import { useAppData } from "../../hooks/useAppData.js";
import { applyTheme } from "../../data/settingsRepository.js";

/**
 * Native App Router chrome: shell, toasts, theme, command palette, shortcuts.
 * Persists across client navigations via the (workspace) layout.
 */
export default function WorkspaceProviders({ children }) {
  const { settings } = useAppData();
  const [commandOpen, setCommandOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    applyTheme(settings.theme);
  }, [settings.theme]);

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
