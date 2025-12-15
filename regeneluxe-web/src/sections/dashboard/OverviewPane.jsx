// src/sections/dashboard/OverviewPane.jsx
import AnalyticsOverview from "../../components/dashboard/widgets/AnalyticsOverview";
import CampaignHealthCard from "../../components/dashboard/widgets/CampaignHealthCard";
import CountdownCard from "../../components/dashboard/widgets/CountdownCard";
import SignalsEngine from "../../components/dashboard/widgets/SignalsEngine";
import TimelineFlowView from "../../components/dashboard/widgets/TimelineFlowView";

export default function OverviewPane() {
  return (
    <div className="space-y-6">
      {/* Row 1: Three cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AnalyticsOverview />
        <CampaignHealthCard />
        <CountdownCard />
      </div>

      {/* Row 2: Timeline flow */}
      <TimelineFlowView />

      {/* Row 3: Signals engine */}
      <SignalsEngine />
    </div>
  );
}

