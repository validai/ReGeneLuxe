// src/sections/mission/PerformancePane.jsx
import PerformanceChart from "../../components/dashboard/widgets/PerformanceChart";
import DonutROI from "../../components/dashboard/widgets/DonutROI";
import ConversionBar from "../../components/dashboard/widgets/ConversionBar";
import EmotionRadar from "../../components/dashboard/widgets/EmotionRadar";
import PastCampaignsCard from "../../components/dashboard/widgets/PastCampaignsCard";
import EngagementHeatmap from "../../components/dashboard/widgets/EngagementHeatmap";

// Sample data (same as Dashboard.jsx)
const lineData = [
  {
    id: "Conversions",
    data: [
      { x: "Day 1", y: 22 },
      { x: "Day 2", y: 34 },
      { x: "Day 3", y: 28 },
      { x: "Day 4", y: 51 },
      { x: "Day 5", y: 46 },
      { x: "Day 6", y: 63 },
      { x: "Day 7", y: 58 },
    ],
  },
];

const barData = [
  { label: "Week 1", meta: 42, tiktok: 28, youtube: 16, search: 12 },
  { label: "Week 2", meta: 58, tiktok: 37, youtube: 19, search: 14 },
  { label: "Week 3", meta: 63, tiktok: 33, youtube: 26, search: 17 },
];

const radarData = [
  { emotion: "Calm", score: 82 },
  { emotion: "Urgent", score: 71 },
  { emotion: "Aspirational", score: 88 },
  { emotion: "Playful", score: 64 },
  { emotion: "Technical", score: 59 },
];

const ctrDonutData = [
  { id: "Meta", label: "Meta", value: 42 },
  { id: "TikTok", label: "TikTok", value: 31 },
  { id: "YouTube", label: "YouTube", value: 17 },
  { id: "Search", label: "Search", value: 10 },
];

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

export default function PerformancePane() {
  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top: Line chart (2/3) + Donut (1/3) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2">
          <PerformanceChart data={lineData} />
        </div>
        <DonutROI title="CTR share by channel" data={ctrDonutData} />
      </div>

      {/* Middle: Bar chart + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConversionBar data={barData} />
        <EmotionRadar data={radarData} />
      </div>

      {/* Past benchmarks */}
      <PastCampaignsCard />

      {/* Bottom: Full-width heatmap */}
      <EngagementHeatmap data={heatmapData} />
    </div>
  );
}

