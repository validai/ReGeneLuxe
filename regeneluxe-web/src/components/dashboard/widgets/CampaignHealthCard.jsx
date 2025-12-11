// src/components/dashboard/widgets/CampaignHealthCard.jsx
import { getActiveCampaign } from "../../../utils/campaignStore";

export default function CampaignHealthCard() {
  const campaign = getActiveCampaign();
  const healthScore = Number(campaign?.metrics?.healthScore || 0);

  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <p className="text-[10px] uppercase tracking-[0.22em] text-[var(--dash-muted)]">
        Health
      </p>
      <h3 className="text-sm font-semibold mt-1">Campaign health score</h3>

      <div className="flex items-center gap-4 mt-4">
        <div className="relative h-20 w-20">
          <div className="absolute inset-0 rounded-full bg-[var(--dash-bg)] border border-[var(--dash-border)]" />
          <div className="absolute inset-1 rounded-full bg-gradient-to-br from-[var(--accent-soft)] to-transparent flex items-center justify-center">
            <span className="text-2xl font-semibold">{healthScore}</span>
          </div>
        </div>

        <div className="text-xs space-y-2">
          <p className="text-[var(--dash-muted)]">
            This score blends spend pacing, conversion rate, fatigue warnings,
            and creative freshness.
          </p>
          <ul className="space-y-1">
            <li className="flex items-center gap-2">
              <Dot color="var(--success)" /> CPA within target band.
            </li>
            <li className="flex items-center gap-2">
              <Dot color="var(--warning)" /> TikTok frequency nearing fatigue.
            </li>
            <li className="flex items-center gap-2">
              <Dot color="var(--success)" /> New hooks testing above baseline.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function Dot({ color }) {
  return (
    <span
      className="h-2.5 w-2.5 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}


