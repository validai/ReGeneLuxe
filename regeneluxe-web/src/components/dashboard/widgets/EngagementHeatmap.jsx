// src/components/dashboard/widgets/EngagementHeatmap.jsx
import { ResponsiveHeatMap } from "@nivo/heatmap";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function EngagementHeatmap({ data }) {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6 h-96">
      <h3 className="text-sm font-semibold mb-3">
        Engagement by day & hour (all channels)
      </h3>
      <ResponsiveHeatMap
        data={data}
        theme={nivoDarkTheme}
        margin={{ top: 30, right: 60, bottom: 50, left: 60 }}
        axisTop={{
          tickRotation: -30,
        }}
        axisLeft={{
          tickPadding: 8,
        }}
        colors={{
          type: "sequential",
          scheme: "reds",
        }}
        cellBorderColor="var(--dash-bg)"
        cellOpacity={0.95}
      />
    </div>
  );
}


