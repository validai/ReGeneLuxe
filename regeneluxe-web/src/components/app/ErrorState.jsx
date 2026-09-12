import { useState } from "react";

export default function ErrorState({ title = "Something went wrong", body, action, details }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-rl_danger/30 bg-rl_surface px-6 py-8 text-center">
      <h2 className="text-base font-semibold text-rl_text">{title}</h2>
      {body && <p className="mx-auto mt-2 max-w-md text-sm text-rl_muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
      {details && (
        <div className="mt-4 text-left">
          <button
            type="button"
            className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
          >
            {open ? "Hide details" : "Details"}
          </button>
          {open && (
            <pre className="mt-2 overflow-x-auto rounded-lg border border-rl_border bg-rl_bg px-3 py-2 text-left text-[11px] text-rl_muted whitespace-pre-wrap">
              {typeof details === "string" ? details : JSON.stringify(details, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
