export default function FormField({
  id,
  label,
  hint,
  error,
  children,
}) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-rl_muted">
          {label}
        </label>
      )}
      <div className={label ? "mt-1" : ""}>{children}</div>
      {hint && !error && <p className="mt-1 text-[11px] text-rl_muted/80">{hint}</p>}
      {error && <p className="mt-1 text-[11px] text-rl_danger">{error}</p>}
    </div>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-rl_border bg-rl_bg px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:border-rl_accent focus:outline-none focus:ring-1 focus:ring-rl_accent/60";
