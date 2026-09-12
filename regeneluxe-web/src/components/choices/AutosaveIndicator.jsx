export default function AutosaveIndicator({ state }) {
  const label = state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "";
  if (!label) return null;
  return <p className="text-[11px] uppercase tracking-[0.16em] text-rl_muted">{label}</p>;
}
