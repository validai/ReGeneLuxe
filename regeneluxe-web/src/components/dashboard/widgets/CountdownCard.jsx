// src/components/dashboard/widgets/CountdownCard.jsx
export default function CountdownCard() {
  return (
    <div className="rl-panel-roomy flex flex-col justify-between">
      <div>
        <p className="text-[10px] uppercase tracking-[0.22em] text-rl_muted">
          Flight plan
        </p>
        <h3 className="text-sm font-semibold mt-1 text-rl_text">Schedule & pacing</h3>
      </div>

      <div className="mt-4 grid gap-3 text-xs">
        <Row label="Launch date" value="Jan 08, 2026" />
        <Row label="Projected end" value="Feb 20, 2026" />
        <Row label="Days remaining" value="12" />
        <Row label="Pacing" value="On track (93% of target)" />
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-rl_muted">{label}</span>
      <span className="font-semibold text-rl_text">{value}</span>
    </div>
  );
}


