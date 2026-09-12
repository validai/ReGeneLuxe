import { Link } from "@/nav";
import { useMemo } from "react";
import NextBestAction from "../../components/app/NextBestAction.jsx";
import AttentionCenter from "../../components/app/AttentionCenter.jsx";
import MetricCard from "../../components/app/MetricCard.jsx";
import {
  buildCampaignStateSnapshot,
  nextBestAction,
  ATTENTION_LEVELS,
} from "../../data/campaignMonitor.js";
import { useAppData } from "../../hooks/useAppData.js";
import { formatStamp } from "../../utils/dates.js";

function metricLabel(key) {
  return String(key).replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

export default function OverviewPanel({ campaign, accounts, content, decisions }) {
  const { snapshots, queue, inbox } = useAppData();
  const snapshot = useMemo(
    () => buildCampaignStateSnapshot(campaign, { accounts, content, snapshots, queue, inbox, decisions }),
    [campaign, accounts, content, snapshots, queue, inbox, decisions]
  );
  const next = nextBestAction(snapshot);
  const attention = snapshot.attention || [];
  const blockers = attention.filter((item) => ["ACTION", "WARNING", "ERROR"].includes(item.level));
  const upcoming = content
    .filter((item) => item.campaignId === campaign.id && item.status === "SCHEDULED")
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
    .slice(0, 3);
  const recent = (snapshot.recentChanges || []).slice(0, 5);
  const campaignContent = content.filter((item) => item.campaignId === campaign.id);

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm text-rl_muted">{snapshot.objective || "No goal yet."}</p>
        <p className="mt-2 text-xs text-rl_muted">{snapshot.progressLabel}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-rl_muted">
          {snapshot.accounts.participating.length === 0 && <span>No accounts attached</span>}
          {snapshot.accounts.participating.map((account) => (
            <span key={account.id}>{account.label}</span>
          ))}
        </div>
      </section>

      <section>
        <h2 className="rl-label">What ReGeneLuxe sees</h2>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-rl_text">{snapshot.summary}</p>
      </section>

      {next && (
        <NextBestAction
          title="Next"
          message={next.label}
          href={next.href}
          actionLabel={next.severity === ATTENTION_LEVELS.ACTION ? "Review" : "Open"}
        />
      )}

      <AttentionCenter
        title="Needs attention"
        items={blockers}
        events={recent}
        showEvents
        accounts={accounts}
        content={campaignContent}
        emptyMessage="All clear — nothing needs you on this campaign right now."
      />

      <div className="grid gap-8 md:grid-cols-2">
        <section>
          <h2 className="rl-label">Performance</h2>
          {snapshot.analytics.primaryMetrics.length === 0 ? (
            <p className="mt-3 text-sm text-rl_muted">No recorded metrics yet.</p>
          ) : (
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              {snapshot.analytics.primaryMetrics.slice(0, 4).map((metric) => (
                <MetricCard
                  key={metric.key}
                  label={metricLabel(metric.key)}
                  value={metric.value}
                />
              ))}
            </div>
          )}
          {snapshot.analytics.freshness && (
            <p className="mt-3 text-xs text-rl_muted">Updated {formatStamp(snapshot.analytics.freshness)}</p>
          )}
        </section>

        <section>
          <h2 className="rl-label">Upcoming</h2>
          {upcoming.length === 0 ? (
            <p className="mt-3 text-sm text-rl_muted">Nothing scheduled.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {upcoming.map((item) => (
                <li key={item.id}>
                  <Link to={`/content/${item.id}`} className="hover:underline">{item.title || "Untitled"}</Link>
                  <span className="ml-2 text-xs text-rl_muted">{formatStamp(item.scheduledAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link to={`/campaigns/${campaign.id}?tab=strategy`} className="rl-btn-ghost">Edit strategy</Link>
        <Link to={`/content/new?campaignId=${campaign.id}`} className="rl-btn-ghost">Create post</Link>
        <Link to={`/campaigns/${campaign.id}?tab=analytics`} className="rl-btn-ghost">Analytics</Link>
      </div>
    </div>
  );
}
