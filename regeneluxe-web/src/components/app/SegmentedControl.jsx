export default function SegmentedControl({ options = [], value, onChange, ariaLabel = "View" }) {
  return (
    <div className="inline-flex rounded-full border border-rl_border bg-rl_surface p-0.5" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const id = option.id || option.value || option;
        const label = option.label || option;
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(id)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors ${
              active ? "bg-rl_accent text-rl_bg" : "text-rl_muted hover:text-rl_text"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
