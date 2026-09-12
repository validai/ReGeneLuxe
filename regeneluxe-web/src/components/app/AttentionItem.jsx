import { Link } from "@/nav";

const TONE = {
  ERROR: "border-rl_danger/40 text-rl_danger",
  WARNING: "border-rl_warning/40 text-rl_warning",
  ACTION: "border-rl_accent/40 text-rl_text",
  INFO: "border-rl_border text-rl_muted",
};

export default function AttentionItem({
  level = "INFO",
  message,
  href,
  meta,
  onAction,
  actionLabel,
}) {
  if (!message) return null;

  const showAction = Boolean(onAction && actionLabel);
  const body = (
    <div className={`rounded-lg border px-3 py-2.5 ${TONE[level] || TONE.INFO}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm">{message}</p>
          {meta && <p className="mt-1 text-xs opacity-80">{meta}</p>}
        </div>
        {showAction && (
          <button
            type="button"
            className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.12em] underline-offset-4 hover:underline"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onAction();
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );

  if (showAction || !href) return body;
  return <Link to={href} className="block transition-opacity hover:opacity-90">{body}</Link>;
}
