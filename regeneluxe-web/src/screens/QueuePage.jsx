import { Link } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import StatusBadge from "../components/app/StatusBadge.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { confirmManualPublish, failQueueJob, processQueueJob, retryQueueJob } from "../data/queueService.js";
import { formatStamp } from "../utils/dates.js";

export default function QueuePage() {
  const { queue, content, accounts, campaigns } = useAppData();

  return (
    <PageShell>
      <PageHeader
        title="Queue"
        description="What ReGeneLuxe will attempt to publish next."
        actions={<Link to="/calendar" className="rl-btn-ghost">Calendar</Link>}
      />

      {queue.length === 0 ? (
        <EmptyState title="Queue empty" body="Schedule content from Create to add jobs." />
      ) : (
        <ul className="divide-y divide-rl_border border-y border-rl_border">
          {queue.map((job) => {
            const item = content.find((entry) => entry.id === job.contentId);
            const account = accounts.find((entry) => entry.id === job.accountId);
            const campaign = campaigns.find((entry) => entry.id === job.campaignId);
            return (
              <li key={job.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{item?.title || "Missing content"}</p>
                  <p className="mt-1 text-xs text-rl_muted">
                    {account ? `${account.platform} · ${account.handle || account.displayName}` : "No account"}
                    {campaign ? ` · ${campaign.name}` : ""}
                    {` · ${formatStamp(job.scheduledAt)}`}
                  </p>
                  {job.failureReason && <p className="mt-2 text-sm text-rl_danger">{job.failureReason}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge value={job.state} />
                  {item && <Link to={`/content/${item.id}`} className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text">Open</Link>}
                  {["queued", "awaiting_approval", "manual_required", "failed"].includes(job.state) && (
                    <button type="button" className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text" onClick={() => processQueueJob(job.id)}>
                      Process
                    </button>
                  )}
                  {job.state === "failed" && (
                    <button type="button" className="text-xs uppercase tracking-[0.12em] text-rl_muted hover:text-rl_text" onClick={() => retryQueueJob(job.id)}>
                      Retry
                    </button>
                  )}
                  {["manual_required", "awaiting_approval", "queued"].includes(job.state) && (
                    <button type="button" className="text-xs uppercase tracking-[0.12em] text-rl_ok hover:text-rl_text" onClick={() => confirmManualPublish(job.id)}>
                      Confirm published
                    </button>
                  )}
                  {job.state !== "completed_manual" && job.state !== "completed" && (
                    <button type="button" className="text-xs uppercase tracking-[0.12em] text-rl_danger" onClick={() => failQueueJob(job.id, "Marked failed by operator.")}>
                      Fail
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
