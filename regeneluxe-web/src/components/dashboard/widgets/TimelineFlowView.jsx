// src/components/dashboard/widgets/TimelineFlowView.jsx
const phases = [
  { label: "Planning", days: "Day -7 – 0", status: "Complete" },
  { label: "Testing hooks", days: "Day 1 – 7", status: "Active" },
  { label: "Scale winners", days: "Day 8 – 21", status: "Queued" },
  { label: "Retain & upsell", days: "Day 22 – 45", status: "Upcoming" },
];

export default function TimelineFlowView() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <h3 className="text-sm font-semibold mb-4">Campaign flight path</h3>
      <div className="grid md:grid-cols-4 gap-3 text-xs">
        {phases.map((p, idx) => (
          <div
            key={p.label}
            className="relative bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-3"
          >
            <p className="text-[10px] text-[var(--dash-muted)]">
              Phase {idx + 1}
            </p>
            <p className="font-semibold">{p.label}</p>
            <p className="text-[10px] text-[var(--dash-muted)] mt-1">
              {p.days}
            </p>
            <p className="mt-2 inline-flex px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em] bg-[var(--accent-soft)] text-[var(--accent)]">
              {p.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}


