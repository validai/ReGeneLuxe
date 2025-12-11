// src/sections/mission/ControlsPane.jsx
import AudienceTuner from "../../components/dashboard/widgets/AudienceTuner";
import BudgetAdjuster from "../../components/dashboard/widgets/BudgetAdjuster";
import ChannelSyncCard from "../../components/dashboard/widgets/ChannelSyncCard";
import QuickActionsPanel from "../../components/dashboard/widgets/QuickActionsPanel";
import { Analytics } from "../../utils/analytics";

export default function ControlsPane() {
  const handleCopilotPreset = (preset) => {
    Analytics.track("copilot_preset_click", { preset });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Control Row: Tuners + Budget + Channel Sync */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-2">
          <AudienceTuner />
        </div>
        <BudgetAdjuster />
        <ChannelSyncCard />
      </div>

      {/* Quick Actions + AI Copilot */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QuickActionsPanel />
        
        {/* AI Copilot Card */}
        <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
          <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
            AI Copilot
          </p>
          <h3 className="text-sm font-semibold mt-1">ReGeneLuxe Copilot</h3>
          <p className="text-xs text-[var(--dash-muted)] mt-2">
            Use smart presets to tweak this campaign without touching the raw blueprint.
          </p>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => handleCopilotPreset("tighten_targeting")}
              className="w-full text-left px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-border)] text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              Tighten targeting
            </button>
            <button
              onClick={() => handleCopilotPreset("test_new_hooks")}
              className="w-full text-left px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-border)] text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              Test new hooks
            </button>
            <button
              onClick={() => handleCopilotPreset("rebalance_budget")}
              className="w-full text-left px-3 py-2 rounded-lg bg-[var(--dash-bg)] border border-[var(--dash-border)] text-xs hover:border-[var(--accent)] hover:text-[var(--accent)] transition"
            >
              Rebalance budget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

