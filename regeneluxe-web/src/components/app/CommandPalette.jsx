import { useEffect, useMemo, useRef, useState } from "react";
import { useAppNavigate as useNavigate } from "@/nav";
import { useAppData } from "../../hooks/useAppData.js";
import { setWorkingAccountId, accountOptionLabel } from "../../data/workingContext.js";
import { setActiveCampaignId } from "../../data/campaignRepository.js";

const STATIC_ACTIONS = [
  { id: "create", label: "Create post", hint: "Composer", run: (navigate) => navigate("/content/new") },
  { id: "campaign", label: "New campaign", hint: "Campaigns", run: (navigate) => navigate("/campaigns") },
  { id: "calendar", label: "Open Calendar", hint: "Go", run: (navigate) => navigate("/calendar") },
  { id: "analytics", label: "Open Analytics", hint: "Go", run: (navigate) => navigate("/analytics") },
  { id: "inbox", label: "Open Inbox", hint: "Go", run: (navigate) => navigate("/inbox") },
  { id: "accounts", label: "Open Accounts", hint: "Go", run: (navigate) => navigate("/accounts") },
  { id: "queue", label: "Open Queue", hint: "Go", run: (navigate) => navigate("/queue") },
  { id: "content", label: "Open Content", hint: "Go", run: (navigate) => navigate("/content") },
  { id: "campaigns", label: "Open Campaigns", hint: "Go", run: (navigate) => navigate("/campaigns") },
  { id: "settings", label: "Open Settings", hint: "Go", run: (navigate) => navigate("/settings") },
  { id: "dashboard", label: "Open Dashboard", hint: "Go", run: (navigate) => navigate("/") },
  { id: "all-accounts", label: "All accounts", hint: "Filter", run: () => setWorkingAccountId("") },
];

/** Shared palette UI — `navigate` is (path: string) => void. */
function CommandPaletteView({ open, onClose, navigate }) {
  const { campaigns, accounts, content } = useAppData();
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const panelRef = useRef(null);
  const previousFocus = useRef(null);

  const actions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const dynamic = [
      ...campaigns.slice(0, 20).map((campaign) => ({
        id: `camp-${campaign.id}`,
        label: campaign.name,
        hint: "Campaign",
        run: (nav) => {
          setActiveCampaignId(campaign.id);
          nav(`/campaigns/${campaign.id}`);
        },
      })),
      ...accounts.slice(0, 20).map((account) => ({
        id: `acc-${account.id}`,
        label: accountOptionLabel(account),
        hint: "Switch account",
        run: () => setWorkingAccountId(account.id),
      })),
      ...content.slice(0, 20).map((item) => ({
        id: `content-${item.id}`,
        label: item.title || item.caption?.slice(0, 48) || "Untitled",
        hint: "Content",
        run: (nav) => nav(`/content/${item.id}`),
      })),
    ];
    const all = [...STATIC_ACTIONS, ...dynamic];
    if (!q) return all.slice(0, 12);
    return all.filter((item) => `${item.label} ${item.hint}`.toLowerCase().includes(q)).slice(0, 12);
  }, [query, campaigns, accounts, content]);

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

  const run = (action) => {
    action?.run?.(navigate);
    onClose?.();
  };

  const updateQuery = (value) => {
    setQuery(value);
    setIndex(0);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/50 px-4 pt-[12vh]">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close search" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-rl_border bg-rl_surface shadow-rl_soft"
      >
        <input
          autoFocus
          className="w-full border-b border-rl_border bg-transparent px-4 py-4 text-base text-rl_text outline-none placeholder:text-rl_muted"
          placeholder="Search or jump…"
          value={query}
          onChange={(event) => updateQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((value) => Math.min(value + 1, Math.max(actions.length - 1, 0)));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((value) => Math.max(value - 1, 0));
            } else if (event.key === "Enter") {
              event.preventDefault();
              run(actions[index]);
            }
          }}
        />
        <ul className="max-h-80 overflow-y-auto py-2">
          {actions.length === 0 && (
            <li className="px-4 py-6 text-sm text-rl_muted">Nothing matches.</li>
          )}
          {actions.map((action, actionIndex) => (
            <li key={action.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm ${
                  actionIndex === index ? "bg-rl_surfaceActive text-rl_text" : "text-rl_textSecondary hover:bg-rl_surfaceHover"
                }`}
                onMouseEnter={() => setIndex(actionIndex)}
                onClick={() => run(action)}
              >
                <span>{action.label}</span>
                <span className="text-xs text-rl_muted">{action.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function CommandPaletteWithRouter(props) {
  const navigate = useNavigate();
  return <CommandPaletteView {...props} navigate={navigate} />;
}

/**
 * Pass `navigate={(path) => ...}` to inject a navigator; otherwise uses shared `@/nav`.
 */
export default function CommandPalette({ open, onClose, navigate }) {
  if (typeof navigate === "function") {
    return <CommandPaletteView open={open} onClose={onClose} navigate={navigate} />;
  }
  return <CommandPaletteWithRouter open={open} onClose={onClose} />;
}

export { CommandPaletteView };
