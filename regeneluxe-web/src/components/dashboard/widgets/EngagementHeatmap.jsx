// src/components/dashboard/widgets/EngagementHeatmap.jsx
import { ResponsiveHeatMap } from "@nivo/heatmap";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function EngagementHeatmap({ data }) {
  return (
    <div className="rl-panel-roomy">
      <h3 className="text-sm font-semibold mb-3 text-rl_text">
        Engagement by day & hour (all channels)
      </h3>
      <div className="overflow-hidden rounded-2xl bg-[#050609] h-96 mt-2">
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
    </div>
  );
}


