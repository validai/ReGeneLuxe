// src/sections/dashboard/ControlsPane.jsx
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
    <div className="space-y-6">
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
        <div className="rl-panel-roomy">
          <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
            AI Copilot
          </p>
          <h3 className="text-sm font-semibold mt-1 text-rl_text">ReGeneLuxe Copilot</h3>
          <p className="text-xs text-rl_muted mt-2">
            Use smart presets to tweak this campaign without touching the raw blueprint.
          </p>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => handleCopilotPreset("tighten_targeting")}
              className="w-full text-left px-3 py-2 rounded-lg bg-rl_surfaceSoft border border-rl_border/30 text-xs text-rl_text hover:border-rl_accent hover:text-rl_accent transition"
            >
              Tighten targeting
            </button>
            <button
              onClick={() => handleCopilotPreset("test_new_hooks")}
              className="w-full text-left px-3 py-2 rounded-lg bg-rl_surfaceSoft border border-rl_border/30 text-xs text-rl_text hover:border-rl_accent hover:text-rl_accent transition"
            >
              Test new hooks
            </button>
            <button
              onClick={() => handleCopilotPreset("rebalance_budget")}
              className="w-full text-left px-3 py-2 rounded-lg bg-rl_surfaceSoft border border-rl_border/30 text-xs text-rl_text hover:border-rl_accent hover:text-rl_accent transition"
            >
              Rebalance budget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

