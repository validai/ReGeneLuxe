// src/components/dashboard/widgets/BudgetAdjuster.jsx
export default function BudgetAdjuster() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
        Budget
      </p>
      <h3 className="text-sm font-semibold mt-1">Daily pacing controls</h3>

      <div className="mt-4 space-y-3 text-xs">
        <Row label="Daily cap" value="$500" />
        <Row label="Month-to-date spend" value="$8,430 / $15,000" />

        <div className="space-y-1.5">
          <p className="text-[11px] text-[var(--dash-muted)]">
            Adjust daily spend
          </p>
          <input type="range" min="0" max="100" className="w-full" />
          <p className="text-[10px] text-[var(--dash-muted)]">
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
      <span className="text-[var(--dash-muted)]">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}


