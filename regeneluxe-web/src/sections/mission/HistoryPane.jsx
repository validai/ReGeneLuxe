// src/sections/mission/HistoryPane.jsx
import PastCampaignsCard from "../../components/dashboard/widgets/PastCampaignsCard";
import SignalsEngine from "../../components/dashboard/widgets/SignalsEngine";
import EngagementHeatmap from "../../components/dashboard/widgets/EngagementHeatmap";
import TimelineFlowView from "../../components/dashboard/widgets/TimelineFlowView";

// Sample data (same as Dashboard.jsx)
const heatmapData = [
  {
    id: "Mon",
    data: [
      { x: "08:00", y: 10 },
      { x: "12:00", y: 23 },
      { x: "16:00", y: 30 },
      { x: "20:00", y: 18 },
    ],
  },
  {
    id: "Tue",
    data: [
      { x: "08:00", y: 8 },
      { x: "12:00", y: 19 },
      { x: "16:00", y: 29 },
      { x: "20:00", y: 21 },
    ],
  },
  {
    id: "Wed",
    data: [
      { x: "08:00", y: 12 },
      { x: "12:00", y: 27 },
      { x: "16:00", y: 34 },
      { x: "20:00", y: 24 },
    ],
  },
];

export default function HistoryPane() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dash-muted)] mb-2">
        Mission Control · History
      </p>

      {/* Top row: Past benchmarks (2/3) + Signals log (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <PastCampaignsCard />
        </div>
        <SignalsEngine />
      </div>

      {/* Timeline flow view */}
      <TimelineFlowView />

      {/* Bottom row: Full-width heatmap */}
      <EngagementHeatmap data={heatmapData} />
    </div>
  );
}

