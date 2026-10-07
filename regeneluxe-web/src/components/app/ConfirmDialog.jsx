import { useEffect, useRef } from "react";

export default function ConfirmDialog({
  open,
  title,
  body,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    cancelRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onCancel?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Dismiss" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-rl_border bg-rl_surface p-6 shadow-rl_soft">
        <h2 id="confirm-title" className="font-display text-xl font-semibold tracking-tight text-rl_text">
          {title}
        </h2>
        {body ? <div className="mt-2 text-sm text-rl_muted">{body}</div> : null}
        {children}
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rl-btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={confirmDisabled}
            className={`${danger ? "rl-btn-danger" : "rl-btn"} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
