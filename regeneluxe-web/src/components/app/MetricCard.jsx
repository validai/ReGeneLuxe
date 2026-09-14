export default function MetricCard({ label, value, delta }) {
  if (value == null || value === "") return null;

  const deltaText = typeof delta === "number"
    ? `${delta > 0 ? "+" : delta < 0 ? "-" : ""}${Math.abs(Math.round(delta))}%`
    : delta;

  return (
    <div className="min-w-0">
      <p className="rl-label">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-rl_text">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {deltaText != null && deltaText !== "" && (
        <p className="mt-1 text-xs tabular-nums text-rl_muted">{deltaText}</p>
      )}
    </div>
  );
}
