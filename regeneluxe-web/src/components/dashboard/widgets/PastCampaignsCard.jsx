// src/components/dashboard/widgets/PastCampaignsCard.jsx
const rows = [
  { name: "Holiday 2025 Evergreen", roi: "3.4x", cpa: "$21.10" },
  { name: "Spring Launch – Founders", roi: "2.7x", cpa: "$24.90" },
  { name: "Always-on Nurture", roi: "1.9x", cpa: "$32.40" },
];

export default function PastCampaignsCard() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <h3 className="text-sm font-semibold mb-3">Past campaign benchmarks</h3>
      <div className="text-xs divide-y divide-[var(--dash-border)] border border-[var(--dash-border)] rounded-lg overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] bg-[var(--dash-bg)] px-3 py-2 font-semibold">
          <span>Name</span>
          <span>ROI</span>
          <span>CPA</span>
        </div>
        {rows.map((r) => (
          <div
            key={r.name}
            className="grid grid-cols-[minmax(0,1.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)] px-3 py-2 bg-[var(--dash-surface-alt)]"
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


