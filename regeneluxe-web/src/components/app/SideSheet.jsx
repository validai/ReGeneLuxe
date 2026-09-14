import { useEffect, useRef } from "react";
import Icon from "./Icon.jsx";

export default function SideSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = "md",
}) {
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    previousFocus.current = document.activeElement;
    const panel = panelRef.current;
    const focusable = () =>
      panel?.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) || [];

    const nodes = focusable();
    const first = nodes[0];
    if (first instanceof HTMLElement) first.focus();
    else panel?.focus();

    const onKey = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
        return;
      }
      if (event.key !== "Tab") return;
      const list = [...focusable()];
      if (list.length === 0) return;
      const firstEl = list[0];
      const lastEl = list[list.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      if (previousFocus.current instanceof HTMLElement) previousFocus.current.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const widthClass = width === "lg" ? "max-w-xl" : width === "sm" ? "max-w-sm" : "max-w-md";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        className="absolute inset-0 bg-black/45 transition-opacity duration-rl"
        onClick={onClose}
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title || "Details"}
        className={`relative flex h-full w-full ${widthClass} flex-col border-l border-rl_border bg-rl_surface shadow-rl_sheet animate-in`}
      >
        <header className="flex items-start justify-between gap-3 border-b border-rl_border px-5 py-4">
          <div>
            {title && <h2 className="font-display text-xl font-semibold tracking-tight text-rl_text">{title}</h2>}
            {subtitle && <p className="mt-1 text-sm text-rl_muted">{subtitle}</p>}
          </div>
          <button type="button" className="rl-btn-icon" onClick={onClose} aria-label="Close">
            <Icon name="close" size="md" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="border-t border-rl_border px-5 py-4">{footer}</footer>
        )}
      </aside>
    </div>
  );
}
