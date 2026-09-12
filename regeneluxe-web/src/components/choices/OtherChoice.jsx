export default function OtherChoice({
  open,
  value,
  onChange,
  placeholder = "Describe other",
}) {
  if (!open) return null;
  return (
    <input
      className="rl-input mt-3"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
