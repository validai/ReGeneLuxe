// src/components/dashboard/widgets/PastCampaignsCard.jsx
const rows = [
  { name: "Holiday 2025 Evergreen", roi: "3.4x", cpa: "$21.10" },
  { name: "Spring Launch – Founders", roi: "2.7x", cpa: "$24.90" },
  { name: "Always-on Nurture", roi: "1.9x", cpa: "$32.40" },
];

export default function PastCampaignsCard() {
  return (
    <div className="rl-panel-roomy">
      <h3 className="text-sm font-semibold mb-3 text-rl_text">Past campaign benchmarks</h3>
      <div className="text-xs divide-y divide-rl_border/30 border border-rl_border/30 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] bg-rl_surfaceSoft px-3 py-2 font-semibold text-rl_text">
          <span>Name</span>
          <span>ROI</span>
          <span>CPA</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] px-3 py-2 bg-rl_surface text-rl_text"
          >
            <span>{r.name}</span>
            <span>{r.roi}</span>
            <span>{r.cpa}</span>
          </div>
        ))}
      </div>
    </div>
  );
}


