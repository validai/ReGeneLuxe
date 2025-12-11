// src/components/dashboard/widgets/SignalsEngine.jsx
const signals = [
  {
    id: 1,
    severity: "warning",
    title: "TikTok hook fatigue detected",
    detail: "CTR down 18% vs last week. Consider rotating 2 new openings.",
  },
  {
    id: 2,
    severity: "info",
    title: "Meta broad audience performing above baseline",
    detail: "CPA 12% lower than stacked interest sets.",
  },
  {
    id: 3,
    severity: "critical",
    title: "YouTube remarketing budget underspending",
    detail: "Only 44% of daily cap being spent. Check frequency + caps.",
  },
];

export default function SignalsEngine() {
  return (
    <div className="bg-[var(--dash-surface)] border border-[var(--dash-border)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Signals engine</h3>
        <p className="text-[10px] text-[var(--dash-muted)]">
          Automated health alerts from your stack
        </p>
      </div>

      <ul className="space-y-2 text-xs">
        {signals.map((s) => (
          <li
            key={s.id}
            className="flex items-start gap-3 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2.5"
          >
            <SeverityBadge level={s.severity} />
            <div>
              <p className="font-semibold">{s.title}</p>
              <p className="text-[var(--dash-muted)] mt-0.5">{s.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeverityBadge({ level }) {
  const map = {
    info: { label: "Info", color: "bg-sky-500/30 text-sky-300" },
    warning: { label: "Warning", color: "bg-[var(--warning)]/20 text-[var(--warning)]" },
    critical: { label: "Critical", color: "bg-[var(--error)]/25 text-[var(--error)]" },
  };
  const cfg = map[level] || map.info;

  return (
    <span
      className={[
        "mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-[0.16em]",
        cfg.color,
      ].join(" ")}
    >
      {cfg.label}
    </span>
  );
}


