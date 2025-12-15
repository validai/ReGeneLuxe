// src/components/dashboard/widgets/PerformanceChart.jsx
import { ResponsiveLine } from "@nivo/line";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function PerformanceChart({ data }) {
  return (
    <div className="rl-panel-roomy">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
            Trajectory
          </p>
          <h3 className="text-sm font-semibold mt-1 text-rl_text">Conversions over time</h3>
        </div>
        <p className="text-[10px] text-rl_muted">
          Last 14 days · All channels
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl bg-[#050609] h-80 mt-2">
        <ResponsiveLine
        data={data}
        theme={nivoDarkTheme}
        margin={{ top: 10, right: 20, bottom: 35, left: 40 }}
        xScale={{ type: "point" }}
        yScale={{ type: "linear", min: 0, max: "auto", stacked: false }}
        curve="monotoneX"
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -25,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
        }}
        enableGridX={false}
        colors={["#38bdf8"]}
        lineWidth={3}
        pointSize={6}
        pointBorderWidth={1}
        pointBorderColor="#0f172a"
        useMesh
        />
      </div>
    </div>
  );
}


