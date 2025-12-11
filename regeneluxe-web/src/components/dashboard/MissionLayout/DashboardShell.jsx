// src/components/dashboard/MissionLayout/DashboardShell.jsx
import SidebarNav from "./SidebarNav";
import TopStatusBar from "./TopStatusBar";
import RightAICommander from "./RightAICommander";

export default function DashboardShell({
  activeView,
  onViewChange,
  hasCampaign,
  activeCampaign,
  children,
}) {
  return (
    <div className="fixed inset-0 flex w-full bg-[var(--dash-bg)] text-[var(--dash-text)] overflow-hidden z-50">
      {/* LEFT SIDEBAR */}
      <SidebarNav activeView={activeView} setActiveView={onViewChange} />

      {/* MAIN COLUMN */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopStatusBar />

        <main className="flex-1 overflow-y-auto px-8 py-6 space-y-6">
          {children}
        </main>
      </div>

      {/* RIGHT AI PANEL */}
      <RightAICommander />
    </div>
  );
}

