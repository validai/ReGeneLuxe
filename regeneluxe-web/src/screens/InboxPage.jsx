import { useEffect, useMemo, useState } from "react";
import { Link } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import StatusBadge from "../components/app/StatusBadge.jsx";
import FilterBar from "../components/app/FilterBar.jsx";
import SideSheet from "../components/app/SideSheet.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { saveInteraction, saveDecision, saveActivity } from "../data/collectionRepository.js";
import { hasCapability } from "../data/connectors/registry.js";
import { emptyDecision } from "../data/domain.js";
import { formatStamp } from "../utils/dates.js";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "comment", label: "Comments" },
  { id: "mention", label: "Mentions" },
  { id: "message", label: "Messages" },
  { id: "needs", label: "Needs reply" },
  { id: "handled", label: "Handled" },
];

function shortenText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) return "";
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
  if (sentences.length > 1) return sentences.slice(0, Math.max(1, Math.ceil(sentences.length / 2))).join(" ");
  const words = trimmed.split(/\s+/);
  if (words.length <= 8) return trimmed;
  return `${words.slice(0, Math.ceil(words.length * 0.6)).join(" ")}…`;
}

function friendlierText(text) {
  return String(text || "")
    .replace(/\bI need\b/gi, "Could you")
    .replace(/\bYou must\b/gi, "It would help if you")
    .replace(/\bASAP\b/g, "when you can")
    .replace(/\b!!!+/g, "!")
    .replace(/\bplease\b/gi, "please")
    .trim();
}

function suggestResponse(item) {
  const name = item.sender || "there";
  const snippet = String(item.message || "").trim().slice(0, 80);
  if (item.type === "mention") {
    return `Thanks for the mention, ${name} — glad this landed with you.`;
  }
  if (item.type === "message") {
    return `Hi ${name}, thanks for reaching out. Happy to help — ${snippet ? `re: “${snippet}${item.message.length > 80 ? "…" : ""}”` : "what can we clarify?"}`;
  }
  return `Thanks ${name} — appreciate you weighing in${snippet ? ` on “${snippet}${item.message.length > 80 ? "…" : ""}”` : ""}.`;
}

export default function InboxPage() {
  const { inbox, accounts, campaigns, content, workingAccountId } = useAppData();
  const [filter, setFilter] = useState("all");
  const [campaignId, setCampaignId] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [suggestionPrev, setSuggestionPrev] = useState("");
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1279px)");
    const update = () => setNarrow(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const items = useMemo(() => inbox.filter((item) => {
    if (workingAccountId && item.accountId !== workingAccountId) return false;
    if (campaignId && item.campaignId !== campaignId) return false;
    if (filter === "needs") return !item.handled;
    if (filter === "handled") return item.handled;
    if (filter !== "all") return item.type === filter;
    return true;
  }), [inbox, filter, workingAccountId, campaignId]);

  const selected = items.find((item) => item.id === selectedId) || null;
  const related = selected ? content.find((entry) => entry.id === selected.contentId) : null;
  const selectedAccount = selected ? accounts.find((account) => account.id === selected.accountId) : null;

  const connected = accounts.some((account) => account.connectionState === "CONNECTED" && (
    hasCapability(account, "READ_COMMENTS") || hasCapability(account, "READ_MESSAGES")
  ));

  const filtersActive = filter !== "all" || Boolean(campaignId);

  const openItem = (item) => {
    setSelectedId(item.id);
    setReplyDraft("");
    setSuggestion("");
    setSuggestionPrev("");
    if (!item.read) saveInteraction({ ...item, read: true });
  };

  const applyTransform = (transform) => {
    const source = suggestion || replyDraft || (selected ? suggestResponse(selected) : "");
    setSuggestionPrev(suggestion || replyDraft);
    const next = transform(source);
    setSuggestion(next);
  };

  const acceptSuggestion = () => {
    if (!suggestion) return;
    setReplyDraft(suggestion);
    setSuggestion("");
    setSuggestionPrev("");
  };

  const undoSuggestion = () => {
    setSuggestion(suggestionPrev || "");
    setSuggestionPrev("");
  };

  return (
    <PageShell dense width="workspace">
      <PageHeader title="Inbox" description="Audience replies, when a connection can provide them." />

      {!connected && (
        <p className="text-sm text-rl_muted">
          Inbox is unavailable through current connections. Manual-only accounts do not invent comments or DMs.
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_minmax(280px,360px)]">
        <aside className="space-y-4">
          <FilterBar
            showClear={filtersActive}
            onClear={() => {
              setFilter("all");
              setCampaignId("");
            }}
          >
            <div className="flex w-full flex-col gap-1" role="tablist" aria-label="Inbox filter">
              {FILTERS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === option.id}
                  onClick={() => setFilter(option.id)}
                  className={`rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-[0.12em] transition-colors ${
                    filter === option.id
                      ? "bg-rl_accent/15 text-rl_text"
                      : "text-rl_muted hover:bg-rl_surfaceSoft/50 hover:text-rl_text"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <select className="rl-input w-full" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
            </select>
          </FilterBar>
        </aside>

        <section className="min-w-0">
          {items.length === 0 ? (
            <EmptyState title="No interactions" body="Nothing has been ingested. ReGeneLuxe will not fabricate inbox activity." />
          ) : (
            <ul className="divide-y divide-rl_border border-y border-rl_border">
              {items.map((item) => {
                const account = accounts.find((entry) => entry.id === item.accountId);
                const active = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openItem(item)}
                      className={`flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors hover:bg-rl_surfaceSoft/40 ${active ? "bg-rl_surfaceSoft/60" : ""}`}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-[0.12em] text-rl_muted">
                          {account?.platform || item.provider || "—"}
                        </span>
                        <span className="text-xs text-rl_muted">
                          {account?.handle || account?.displayName || "Unknown account"}
                        </span>
                        <StatusBadge
                          value={item.handled ? "completed" : "awaiting_approval"}
                          label={item.handled ? "Handled" : "Needs reply"}
                        />
                        {!item.read && !item.handled && (
                          <span className="h-1.5 w-1.5 rounded-full bg-rl_accent" aria-label="Unread" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-rl_text">{item.sender || "Unknown"} · {item.type}</p>
                      <p className="line-clamp-2 text-sm text-rl_textSecondary">{item.message || "No preview"}</p>
                      <p className="rl-meta">{formatStamp(item.timestamp)}</p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="hidden xl:block">
          {selected ? (
            <InboxDetail
              item={selected}
              account={selectedAccount}
              related={related}
              replyDraft={replyDraft}
              setReplyDraft={setReplyDraft}
              suggestion={suggestion}
              onSuggest={() => {
                setSuggestionPrev(suggestion || replyDraft);
                setSuggestion(suggestResponse(selected));
              }}
              onShorten={() => applyTransform(shortenText)}
              onFriendlier={() => applyTransform(friendlierText)}
              onAccept={acceptSuggestion}
              onUndo={undoSuggestion}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-rl_border px-4 py-8 text-sm text-rl_muted">
              Select a message to review.
            </div>
          )}
        </aside>
      </div>

      <SideSheet
        open={Boolean(selected) && narrow}
        title={selected?.sender || "Message"}
        subtitle={selected ? `${selected.type} · ${formatStamp(selected.timestamp)}` : ""}
        onClose={() => setSelectedId(null)}
        width="md"
      >
        {selected && (
          <InboxDetail
            item={selected}
            account={selectedAccount}
            related={related}
            replyDraft={replyDraft}
            setReplyDraft={setReplyDraft}
            suggestion={suggestion}
            onSuggest={() => {
              setSuggestionPrev(suggestion || replyDraft);
              setSuggestion(suggestResponse(selected));
            }}
            onShorten={() => applyTransform(shortenText)}
            onFriendlier={() => applyTransform(friendlierText)}
            onAccept={acceptSuggestion}
            onUndo={undoSuggestion}
            compact
          />
        )}
      </SideSheet>
    </PageShell>
  );
}

function InboxDetail({
  item,
  account,
  related,
  replyDraft,
  setReplyDraft,
  suggestion,
  onSuggest,
  onShorten,
  onFriendlier,
  onAccept,
  onUndo,
  compact = false,
}) {
  return (
    <div className={compact ? "space-y-4" : "sticky top-4 space-y-4 rounded-xl border border-rl_border bg-rl_surface/40 px-4 py-4"}>
      {!compact && (
        <div>
          <p className="text-sm font-semibold text-rl_text">{item.sender || "Unknown"}</p>
          <p className="mt-1 rl-meta">
            {account?.platform || item.provider || "—"} · {account?.handle || account?.displayName || "—"} · {item.type}
          </p>
        </div>
      )}

      <div>
        <p className="rl-label">Message</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-rl_text">{item.message || "—"}</p>
      </div>

      {related && (
        <Link to={`/content/${related.id}`} className="inline-block text-xs underline underline-offset-4">
          Related content: {related.title || "Untitled"}
        </Link>
      )}

      <div>
        <label htmlFor={`reply-${item.id}`} className="rl-label">Reply note</label>
        <textarea
          id={`reply-${item.id}`}
          className="rl-input mt-2 min-h-[100px]"
          value={replyDraft}
          onChange={(e) => setReplyDraft(e.target.value)}
          placeholder="Draft a reply locally — sending stays on the platform for now."
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className="rl-btn-ghost" onClick={onSuggest}>Suggest response</button>
        <button type="button" className="rl-btn-ghost" onClick={onShorten}>Shorten</button>
        <button type="button" className="rl-btn-ghost" onClick={onFriendlier}>Friendlier</button>
      </div>

      {suggestion && (
        <div className="rounded-lg border border-rl_border bg-rl_bg px-3 py-3">
          <p className="rl-label">Suggestion</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-rl_textSecondary">{suggestion}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" className="rl-btn" onClick={onAccept}>Accept</button>
            <button type="button" className="rl-btn-ghost" onClick={onUndo}>Undo</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t border-rl_border pt-4">
        <button
          type="button"
          className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text"
          onClick={() => saveInteraction({ ...item, handled: !item.handled })}
        >
          {item.handled ? "Unhandled" : "Mark handled"}
        </button>
        <button
          type="button"
          className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text"
          onClick={() => {
            saveActivity({
              campaignId: item.campaignId || "",
              type: "inbox_task",
              message: `Follow up: ${item.message || item.sender || "inbox item"}`,
              source: "MANUAL",
            });
          }}
        >
          Task
        </button>
        <button
          type="button"
          className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text"
          onClick={() => {
            saveDecision(emptyDecision({
              campaignId: item.campaignId || "",
              decision: `Review inbox: ${item.message || item.type}`,
              evidence: `${item.type} from ${item.sender || "unknown"}`,
              reason: "Operator surfaced interaction to Campaign Brain.",
              affectedAccountIds: item.accountId ? [item.accountId] : [],
              affectedContentIds: item.contentId ? [item.contentId] : [],
              permissionRequired: false,
              status: "proposed",
              source: "MANUAL",
            }));
          }}
        >
          To Brain
        </button>
      </div>

      <p className="text-[11px] text-rl_muted">Reply send unavailable through current connection — notes stay local.</p>
    </div>
  );
}
