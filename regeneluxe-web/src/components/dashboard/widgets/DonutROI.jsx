// src/components/dashboard/widgets/DonutROI.jsx
import { ResponsivePie } from "@nivo/pie";
import { nivoDarkTheme } from "../../../styles/nivoTheme";

export default function DonutROI({ data, title }) {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6 h-72">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <ResponsivePie
        data={data}
        theme={nivoDarkTheme}
        innerRadius={0.7}
        padAngle={1}
        cornerRadius={3}
        activeOuterRadiusOffset={8}
        colors={{ scheme: "set2" }}
        enableArcLinkLabels={false}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor="var(--dash-text)"
      />
    </div>
  );
}


