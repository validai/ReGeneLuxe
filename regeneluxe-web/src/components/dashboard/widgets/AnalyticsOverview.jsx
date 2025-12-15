// src/components/dashboard/widgets/AnalyticsOverview.jsx
import { getActiveCampaign } from "../../../utils/campaignStore";

export default function AnalyticsOverview() {
  const campaign = getActiveCampaign();
  const metrics = campaign?.metrics || {};
  
  const views28d = Number(metrics.views28d || 0);
  const conversions28d = Number(metrics.conversions28d || 0);
  const blendedCpa = Number(metrics.blendedCpa || 0);

  return (
    <div className="rl-panel-roomy">
      <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
        At a glance
      </p>
      <h3 className="text-sm font-semibold mt-1 text-rl_text">Key performance metrics</h3>

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
    <div className="bg-rl_surfaceSoft rounded-lg border border-rl_border/30 p-4">
      <p className="text-[11px] text-rl_muted">{label}</p>
      <p className="text-xl font-semibold mt-1 text-rl_text">{value}</p>
    </div>
  );
}


