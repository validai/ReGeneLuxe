/**
 * Test-only SPA route tree (Vitest + MemoryRouter).
 * Product runtime uses native App Router pages under `app/(workspace)/`.
 */
import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import AppShell from "./components/app/AppShell.jsx";
import CommandPalette from "./components/app/CommandPalette.jsx";
import Skeleton from "./components/app/Skeleton.jsx";
import { ToastProvider } from "./components/app/ToastProvider.jsx";
import DashboardPage from "./screens/DashboardPage.jsx";
import ContentPage from "./screens/ContentPage.jsx";
import QueuePage from "./screens/QueuePage.jsx";
import CampaignsPage from "./screens/CampaignsPage.jsx";
import NotFound from "./screens/NotFound.jsx";
import { useAppData } from "./hooks/useAppData.js";
import { applyTheme } from "./data/settingsRepository.js";

const CalendarPage = lazy(() => import("./screens/CalendarPage.jsx"));
const ComposerPage = lazy(() => import("./screens/ComposerPage.jsx"));
const AnalyticsPage = lazy(() => import("./screens/AnalyticsPage.jsx"));
const CampaignWorkspace = lazy(() => import("./screens/CampaignWorkspace.jsx"));
const InboxPage = lazy(() => import("./screens/InboxPage.jsx"));
const AccountsPage = lazy(() => import("./screens/AccountsPage.jsx"));
const SettingsPage = lazy(() => import("./screens/SettingsPage.jsx"));

function RouteFallback() {
  return (
    <div className="mx-auto w-full max-w-workspace space-y-6 px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      <Skeleton height="h-8" className="w-48" />
      <Skeleton lines={3} />
      <Skeleton height="h-32" className="w-full" />
    </div>
  );
}

export default function App() {
  const { settings } = useAppData();
  const [commandOpen, setCommandOpen] = useState(false);
  const navigate = useNavigate();

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
          navigate("/calendar");
          return;
        }
        if (key === "a") {
          event.preventDefault();
          navigate("/analytics");
          return;
        }
        if (key === "d") {
          event.preventDefault();
          navigate("/");
          return;
        }
        if (key === "i") {
          event.preventDefault();
          navigate("/inbox");
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
        navigate("/content/new");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearTimeout(goTimer);
    };
  }, [navigate]);

  const closeCommand = () => setCommandOpen(false);
  const openCommand = () => setCommandOpen(true);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-rl_bg text-rl_text">
        <AppShell onOpenCommand={openCommand}>
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/queue" element={<QueuePage />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/content/new" element={<ComposerPage />} />
              <Route path="/content/:contentId" element={<ComposerPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/campaigns/:campaignId" element={<CampaignWorkspace />} />
              <Route path="/inbox" element={<InboxPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/dashboard" element={<Navigate to="/" replace />} />
              <Route path="/start" element={<Navigate to="/campaigns" replace />} />
              <Route path="/drafting-room" element={<Navigate to="/content" replace />} />
              <Route path="/campaign/new" element={<Navigate to="/campaigns" replace />} />
              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/gate" element={<Navigate to="/" replace />} />
              <Route path="/thank-you" element={<Navigate to="/" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AppShell>
        {commandOpen ? (
          <CommandPalette key="command-open" open onClose={closeCommand} />
        ) : null}
      </div>
    </ToastProvider>
  );
}
