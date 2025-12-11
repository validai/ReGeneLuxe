// src/components/dashboard/widgets/AnalyticsOverview.jsx
import { getActiveCampaign } from "../../../utils/campaignStore";

export default function AnalyticsOverview() {
  const campaign = getActiveCampaign();
  const metrics = campaign?.metrics || {};
  
  const views28d = Number(metrics.views28d || 0);
  const conversions28d = Number(metrics.conversions28d || 0);
  const blendedCpa = Number(metrics.blendedCpa || 0);

  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
        At a glance
      </p>
      <h3 className="text-sm font-semibold mt-1">Key performance metrics</h3>

      <div className="grid grid-cols-3 gap-3 mt-4">
        <Metric label="Views (28d)" value={views28d.toLocaleString()} />
        <Metric label="Conversions" value={conversions28d.toLocaleString()} />
        <Metric label="Blended CPA" value={blendedCpa ? `$${blendedCpa.toFixed(2)}` : "$0.00"} />
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="bg-[var(--dash-bg)] rounded-lg border border-[var(--dash-border)] p-4">
      <p className="text-[11px] text-[var(--dash-muted)]">{label}</p>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </div>
  );
}


