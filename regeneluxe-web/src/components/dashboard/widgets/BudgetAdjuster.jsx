// src/components/dashboard/widgets/BudgetAdjuster.jsx
export default function BudgetAdjuster() {
  return (
    <div className="rl-panel-roomy">
      <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
        Budget
      </p>
      <h3 className="text-sm font-semibold mt-1 text-rl_text">Daily pacing controls</h3>

      <div className="mt-4 space-y-3 text-xs">
        <Row label="Daily cap" value="$500" />
        <Row label="Month-to-date spend" value="$8,430 / $15,000" />

        <div className="space-y-1.5">
          <p className="text-[11px] text-rl_muted">
            Adjust daily spend
          </p>
          <input type="range" min="0" max="100" className="w-full" />
          <p className="text-[10px] text-rl_muted">
            Slide to increase or reduce daily pace. ReGeneLuxe will rebalance
            channels automatically.
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-rl_muted">{label}</span>
      <span className="font-semibold text-rl_text">{value}</span>
    </div>
  );
}


