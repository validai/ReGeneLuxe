export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="border-b border-rl_border" role="tablist">
      <div className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const active = tab.id === value;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.id)}
              className={[
                "px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                active
                  ? "border-b-2 border-rl_accent text-rl_text"
                  : "text-rl_muted hover:text-rl_text",
              ].join(" ")}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
