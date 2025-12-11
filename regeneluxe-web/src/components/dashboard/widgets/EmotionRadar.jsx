// src/components/dashboard/widgets/EmotionRadar.jsx
import { ResponsiveRadar } from "@nivo/radar";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function EmotionRadar({ data }) {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6 h-80">
      <h3 className="text-sm font-semibold mb-3">Creative "feel" scan</h3>
      <ResponsiveRadar
        data={data}
        keys={["score"]}
        indexBy="emotion"
        maxValue={100}
        theme={nivoDarkTheme}
        margin={{ top: 30, right: 40, bottom: 30, left: 40 }}
        curve="linearClosed"
        borderWidth={2}
        borderColor="#d6b48c"
        gridLevels={5}
        gridShape="circular"
        gridLabelOffset={20}
        enableDots
        dotSize={6}
        dotBorderWidth={1}
        colors={["#d6b48c"]}
        fillOpacity={0.3}
      />
    </div>
  );
}

