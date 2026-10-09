import { Link } from "@/nav";
import { publishDestinationView } from "../../data/connectionFlow.js";

export default function PublishDestinations({ accounts = [], selectedIds = [], onToggle }) {
  const rows = accounts
    .map((account) => ({ account, view: publishDestinationView(account) }))
    .filter((row) => row.view.visible);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-rl_muted">
        No connected destinations yet. <Link to="/accounts" className="underline underline-offset-4">Connect an account</Link>
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {rows.map(({ account, view }) => {
        const active = selectedIds.includes(account.id);
        const label = `${account.platform} ${account.handle || account.displayName || ""}`.trim();
        if (!view.selectable) {
          return (
            <span key={account.id} className="inline-flex items-center gap-2 rounded-full border border-rl_border px-3.5 py-1.5 text-sm text-rl_muted">
              <span>{label}</span>
              <Link to="/accounts" className="underline underline-offset-4">
                {view.action === "reconnect" ? "Reconnect" : "Finish setup"}
              </Link>
            </span>
          );
        }
        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onToggle?.(account.id)}
            aria-pressed={active}
            className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
              active
                ? "border-rl_accent bg-rl_accent/10 text-rl_text"
                : "border-rl_border text-rl_muted hover:border-rl_borderStrong hover:text-rl_text"
            }`}
          >
            {account.platform}
            <span className="ml-1.5 text-rl_muted">{account.handle || account.displayName}</span>
          </button>
        );
      })}
    </div>
  );
}
