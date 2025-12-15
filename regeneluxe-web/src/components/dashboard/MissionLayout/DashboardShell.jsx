// src/components/dashboard/MissionLayout/DashboardShell.jsx
import SiteHeader from "../../SiteHeader";
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
    <div className="min-h-screen flex flex-col bg-rl_bg text-rl_text">
      {/* SiteHeader at the top */}
      <SiteHeader />

      {/* RGL Engine content area */}
      <div className="flex flex-1 overflow-hidden bg-rl_bg">
        {/* LEFT SIDEBAR */}
        <SidebarNav activeView={activeView} setActiveView={onViewChange} />

        {/* MAIN COLUMN */}
        <main className="flex-1 min-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
            <TopStatusBar />
            {children}
          </div>
        </main>

        {/* RIGHT AI PANEL */}
        <RightAICommander />
      </div>
    </div>
  );
}

