// src/components/dashboard/widgets/ConversionBar.jsx
import { ResponsiveBar } from "@nivo/bar";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function ConversionBar({ data }) {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6 h-72">
      <h3 className="text-sm font-semibold mb-3">Conversion mix by channel</h3>
      <ResponsiveBar
        data={data}
        keys={["meta", "tiktok", "youtube", "search"]}
        indexBy="label"
        theme={nivoDarkTheme}
        margin={{ top: 10, right: 20, bottom: 40, left: 40 }}
        padding={0.3}
        groupMode="grouped"
        colors={{ scheme: "set2" }}
        axisBottom={{
          tickPadding: 5,
          tickRotation: -20,
        }}
        axisLeft={{
          tickPadding: 5,
        }}
        enableLabel={false}
      />
    </div>
  );
}


