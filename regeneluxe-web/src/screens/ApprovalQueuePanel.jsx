"use client";

import { useCallback, useEffect, useState } from "react";
import { Link } from "@/nav";
import StatusBadge from "../components/app/StatusBadge.jsx";
import ContentThumbnail from "../components/app/ContentThumbnail.jsx";
import { formatStamp } from "../utils/dates.js";

const FILTERS = [
  ["needs_review", "Needs Review"],
  ["today", "Today"],
  ["this_week", "This Week"],
  ["approved", "Approved"],
  ["skipped", "Skipped"],
  ["all", "All"],
];

function previewText(draft) {
  const caption = String(draft.caption || "").trim();
  if (caption) return caption.length > 140 ? `${caption.slice(0, 140)}…` : caption;
  return draft.title || "Untitled draft";
}

export default function ApprovalQueuePanel() {
  const [filter, setFilter] = useState("needs_review");
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/marketing-drafts?filter=${encodeURIComponent(filter)}`, {
        credentials: "same-origin",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        setError(body.error || "Could not load approval queue.");
        setDrafts([]);
      } else {
        setDrafts(Array.isArray(body.drafts) ? body.drafts : []);
      }
    } catch {
      setError("Could not load approval queue.");
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function review(draftId, action) {
    setBusyId(draftId);
    setNote("");
    setError("");
    try {
      const res = await fetch(`/api/marketing-drafts/${encodeURIComponent(draftId)}`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body.ok === false) {
        setError(body.error || "Review action failed.");
      } else {
        setNote(
          action === "APPROVE"
            ? (body.note || "Creative approved. Scheduled dispatch will run at the assigned time.")
            : action === "SKIP"
              ? "Draft skipped."
              : "Changes requested.",
        );
        await refresh();
      }
    } catch {
      setError("Review action failed.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-rl_text">Approval Queue</h2>
        <p className="mt-1 text-sm text-rl_muted">
          Marketing-team drafts awaiting operator review. Approve binds creative authority to the schedule; provider write happens later via the scheduled dispatch worker.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-xs ${
              filter === id
                ? "border-rl_text bg-rl_surfaceActive text-rl_text"
                : "border-rl_border text-rl_muted hover:text-rl_text"
            }`}
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {note ? <p className="text-xs text-rl_muted">{note}</p> : null}
      {error ? <p className="text-xs text-rl_danger">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-rl_muted">Loading…</p>
      ) : drafts.length === 0 ? (
        <p className="text-sm text-rl_muted">No drafts in this view.</p>
      ) : (
        <ul className="divide-y divide-rl_border border-y border-rl_border">
          {drafts.map((draft) => {
            const when = draft.scheduledFor || draft.requestedScheduledFor;
            const provider = draft.providerReadiness;
            return (
              <li key={draft.id} className="flex flex-col gap-3 py-4">
                <div className="flex items-start gap-3">
                  <ContentThumbnail
                    content={{
                      id: draft.id,
                      title: draft.title,
                      mediaRefs: draft.mediaRefs,
                      caption: draft.caption,
                    }}
                    size="compact"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-rl_text">{draft.title || "Untitled draft"}</p>
                      <StatusBadge value={draft.status} />
                      <StatusBadge value={draft.approvalStatus} />
                    </div>
                    <p className="text-xs text-rl_muted">
                      {formatStamp(when) || "Unscheduled"}
                      {draft.campaignId ? ` · ${draft.campaignId}` : ""}
                      {draft.platform ? ` · ${draft.platform}` : ""}
                      {provider?.handle ? ` · ${provider.handle}` : ""}
                      {draft.contentType ? ` · ${draft.contentType}` : ""}
                    </p>
                    <p className="text-sm text-rl_textSecondary">{previewText(draft)}</p>
                    <p className="text-xs text-rl_muted">
                      Source · {draft.createdByAgentName || draft.createdByAgentRole || "external agent"}
                      {draft.releaseGateState ? ` · Gates ${draft.releaseGateState}` : ""}
                      {draft.creativeApprovalState ? ` · ${draft.creativeApprovalState}` : ""}
                      {provider?.publishState ? ` · ${provider.publishState}` : ""}
                    </p>
                    {Array.isArray(draft.blockingIssues) && draft.blockingIssues.length > 0 ? (
                      <p className="text-xs text-rl_danger">Blocking · {draft.blockingIssues.join(", ")}</p>
                    ) : null}
                    {draft.outNowGuard?.flagged ? (
                      <p className="text-xs text-rl_muted">
                        Out-now copy flagged
                        {draft.outNowGuard.blocking ? ` · ${draft.outNowGuard.issues.join(", ")}` : ""}
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.status === "READY_FOR_REVIEW" || draft.approvalStatus === "PENDING" || draft.approvalStatus === "INVALIDATED" ? (
                    <>
                      <button
                        type="button"
                        className="rl-btn-ghost px-3 py-1.5 text-xs"
                        disabled={busyId === draft.id}
                        onClick={() => review(draft.id, "APPROVE")}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rl-btn-ghost px-3 py-1.5 text-xs"
                        disabled={busyId === draft.id}
                        onClick={() => review(draft.id, "REQUEST_CHANGES")}
                      >
                        Request changes
                      </button>
                      <button
                        type="button"
                        className="rl-btn-ghost px-3 py-1.5 text-xs"
                        disabled={busyId === draft.id}
                        onClick={() => review(draft.id, "SKIP")}
                      >
                        Skip
                      </button>
                    </>
                  ) : null}
                  <Link to={`/content/${draft.id}`} className="px-3 py-1.5 text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text">
                    Open
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
