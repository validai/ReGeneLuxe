export default function ChoiceChip({
  label,
  selected = false,
  onClick,
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] ${
        selected ? "bg-rl_accent text-rl_bg" : "text-rl_muted hover:text-rl_text"
      }`}
    >
      {label}
    </button>
  );
}
