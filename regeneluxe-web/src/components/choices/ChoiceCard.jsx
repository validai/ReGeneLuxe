export default function ChoiceCard({
  type = "checkbox",
  name,
  value,
  label,
  checked,
  onChange,
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-1 focus-within:ring-rl_accent/70 ${
        checked
          ? "border-rl_accent bg-rl_accent/10 text-rl_text"
          : "border-rl_border bg-rl_bg text-rl_muted hover:border-rl_accent/50 hover:text-rl_text"
      }`}
    >
      <input
        type={type}
        name={name}
        value={value}
        className="h-4 w-4 accent-rl_accent"
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );
}
