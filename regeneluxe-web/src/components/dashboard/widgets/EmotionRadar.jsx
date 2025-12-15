// src/components/dashboard/widgets/EmotionRadar.jsx
import { ResponsiveRadar } from "@nivo/radar";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function EmotionRadar({ data }) {
  return (
    <div className="rl-panel-roomy">
      <h3 className="text-sm font-semibold mb-3 text-rl_text">Creative "feel" scan</h3>
      <div className="overflow-hidden rounded-2xl bg-[#050609] h-80 mt-2">
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
    </div>
  );
}

