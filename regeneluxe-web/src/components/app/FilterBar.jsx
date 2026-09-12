export default function FilterBar({ children, onClear, clearLabel = "Clear filters", showClear = false }) {
  const visibleClear = showClear || Boolean(onClear);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {visibleClear && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs uppercase tracking-[0.12em] text-rl_muted transition-colors hover:text-rl_text"
        >
          {clearLabel}
        </button>
      )}
    </div>
  );
}
