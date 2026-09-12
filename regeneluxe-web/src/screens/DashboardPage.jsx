import { useMemo, useState } from "react";
import { Link, useAppNavigate as useNavigate } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import NextBestAction from "../components/app/NextBestAction.jsx";
import AttentionCenter from "../components/app/AttentionCenter.jsx";
import MetricCard from "../components/app/MetricCard.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { setActiveCampaignId } from "../data/campaignRepository.js";
import { buildAttentionFeed, buildCampaignStateSnapshot, ATTENTION_LEVELS } from "../data/campaignMonitor.js";
import { listEvents } from "../data/events.js";
import { filterByWorkingAccount } from "../data/workingContext.js";
import { compareAgainstBaseline, buildAccountBaseline } from "../data/performanceCompare.js";
import { formatDate, formatStamp, toDateKey } from "../utils/dates.js";

function metricLabel(key) {
  return String(key).replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function isApprovalItem(item, readyContent = []) {
  if (!item) return false;
  if (item.kind === "approval" || item.contentId) return true;
  if (!item.href?.startsWith("/content/")) return false;
  return readyContent.some((entry) => item.href === `/content/${entry.id}`);
}

function isConnectionItem(item) {
  return item?.kind === "connection" || item?.href === "/accounts";
}

function approvalIdFrom(item, readyContent = []) {
  return item?.contentId
    || (item?.href?.startsWith("/content/") ? item.href.replace("/content/", "") : null)
    || readyContent[0]?.id
    || null;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { campaigns, accounts, content, inbox, queue, snapshots, decisions, workingAccountId } = useAppData();
  const [forceApprovalId, setForceApprovalId] = useState(null);

  const scopedContent = filterByWorkingAccount(content, accounts, workingAccountId);
  const scopedInbox = filterByWorkingAccount(inbox, accounts, workingAccountId, (item) => [item.accountId]);
  const today = toDateKey(new Date());
  const scheduledToday = scopedContent
    .filter((item) => toDateKey(item.scheduledAt) === today)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)));
  const upcoming = scopedContent
    .filter((item) => item.status === "SCHEDULED" && item.scheduledAt)
    .sort((a, b) => String(a.scheduledAt).localeCompare(String(b.scheduledAt)))
    .slice(0, 5);
  const activeCampaigns = campaigns.filter((campaign) => campaign.active !== false);
  const attention = buildAttentionFeed({
    campaigns: activeCampaigns,
    accounts,
    content: scopedContent,
    queue,
    inbox: scopedInbox,
  });
  const needsYou = attention.filter((item) => ["ACTION", "WARNING", "ERROR"].includes(item.level));
  const next = needsYou[0] || attention.find((item) => item.level === ATTENTION_LEVELS.INFO) || null;
  const recent = listEvents().slice(0, 5);
  const readyContent = scopedContent.filter((item) => item.status === "READY");

  const campaignLines = activeCampaigns.slice(0, 4).map((campaign) => {
    const snap = buildCampaignStateSnapshot(campaign, {
      accounts,
      content,
      snapshots,
      queue,
      inbox,
      decisions,
    });
    return { campaign, snap };
  });

  const connectionIssues = accounts.filter((account) => ["ERROR", "AUTH_EXPIRED"].includes(account.connectionState));

  const performanceCards = useMemo(() => {
    const cards = [];
    const accountId = workingAccountId || snapshots[0]?.accountId;
    const scopedSnaps = snapshots.filter((snap) => {
      if (workingAccountId && snap.accountId !== workingAccountId) return false;
      return true;
    });
    if (!scopedSnaps.length) return cards;

    const latest = scopedSnaps
      .slice()
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)))[0];
    const metrics = latest?.metrics || {};
    const preferred = ["engagementRate", "reach", "views", "impressions", "likes", "clicks"];
    const keys = preferred.filter((key) => metrics[key] != null && metrics[key] !== "");
    const fallback = Object.entries(metrics)
      .filter(([, value]) => value != null && value !== "" && !Number.isNaN(Number(value)))
      .map(([key]) => key);
    const chosen = (keys.length ? keys : fallback).slice(0, 3);
    if (!chosen.length) return cards;

    let comparisons = [];
    if (accountId) {
      const baseline = buildAccountBaseline(snapshots.filter((snap) => snap.accountId === accountId));
      if (baseline.available) {
        comparisons = compareAgainstBaseline(metrics, baseline).comparisons || [];
      }
    }

    chosen.forEach((key) => {
      const comparison = comparisons.find((entry) => entry.key === key);
      const delta = comparison && comparison.classification !== "INSUFFICIENT_DATA"
        ? Math.round((comparison.relative || 0) * 100)
        : null;
      cards.push({
        key,
        label: metricLabel(key),
        value: Number(metrics[key]),
        delta: delta != null ? delta : undefined,
      });
    });
    return cards;
  }, [snapshots, workingAccountId]);

  return (
    <PageShell>
      <PageHeader
        title="Dashboard"
        description="Today, what needs you, and what ReGeneLuxe recommends."
        actions={<button type="button" className="rl-btn" onClick={() => navigate("/content/new")}>+ Create</button>}
      />

      {campaigns.length === 0 && content.length === 0 ? (
        <EmptyState
          title="Nothing in motion yet"
          body="Create a post or start a campaign."
          action={<button type="button" onClick={() => navigate("/content/new")} className="rl-btn">Create</button>}
        />
      ) : (
        <div className="space-y-8">
          {next && (
            <NextBestAction
              title="ReGeneLuxe recommends"
              message={next.message}
              href={isApprovalItem(next, readyContent) || isConnectionItem(next) ? undefined : next.href}
              onAction={
                isApprovalItem(next, readyContent)
                  ? () => setForceApprovalId(approvalIdFrom(next, readyContent))
                  : isConnectionItem(next)
                    ? () => navigate("/accounts")
                    : undefined
              }
              actionLabel={
                isApprovalItem(next, readyContent)
                  ? "Review"
                  : isConnectionItem(next)
                    ? "Reconnect"
                    : (next.level === "ACTION" || next.level === "ERROR" ? "Review" : "Open")
              }
            />
          )}

          <div className="grid gap-8 xl:grid-cols-[1.2fr_1fr]">
            <section>
              <h2 className="rl-label">Today</h2>
              {scheduledToday.length === 0 ? (
                <p className="mt-3 text-sm text-rl_muted">Nothing scheduled today.</p>
              ) : (
                <ul className="mt-3 divide-y divide-rl_border border-y border-rl_border">
                  {scheduledToday.slice(0, 6).map((item) => {
                    const account = accounts.find((entry) => (item.accountIds || []).includes(entry.id));
                    return (
                      <li key={item.id} className="py-3">
                        <Link to={`/content/${item.id}`} className="block hover:opacity-90">
                          <p className="text-sm font-medium">{item.title || "Untitled"}</p>
                          <p className="mt-1 text-xs text-rl_muted">
                            {formatStamp(item.scheduledAt)}
                            {account ? ` · ${account.platform} · ${account.handle || account.displayName}` : ""}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <AttentionCenter
              title="Needs you"
              items={needsYou}
              events={recent}
              showEvents
              accounts={accounts}
              content={scopedContent}
              forceApprovalId={forceApprovalId}
              onForceApprovalHandled={() => setForceApprovalId(null)}
              emptyMessage="Nothing needs you right now."
            />
          </div>

          {performanceCards.length > 0 && (
            <section>
              <h2 className="rl-label">Performance</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-3">
                {performanceCards.map((card) => (
                  <MetricCard
                    key={card.key}
                    label={card.label}
                    value={card.value}
                    delta={card.delta}
                  />
                ))}
              </div>
            </section>
          )}

          <div className="grid gap-8 lg:grid-cols-2">
            <section>
              <h2 className="rl-label">Campaigns</h2>
              {campaignLines.length === 0 ? (
                <p className="mt-3 text-sm text-rl_muted">No active campaigns.</p>
              ) : (
                <ul className="mt-3 space-y-4">
                  {campaignLines.map(({ campaign, snap }) => (
                    <li key={campaign.id}>
                      <Link
                        to={`/campaigns/${campaign.id}`}
                        onClick={() => setActiveCampaignId(campaign.id)}
                        className="block rounded-xl border border-rl_border bg-rl_surface px-4 py-3 transition-colors hover:border-rl_borderStrong"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{campaign.name}</p>
                            <p className="mt-1 text-xs text-rl_muted">{snap.progressLabel}</p>
                          </div>
                          <p className="text-[11px] uppercase tracking-[0.12em] text-rl_muted">
                            {formatDate(campaign.updatedAt)}
                          </p>
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-rl_textSecondary">{snap.summary}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="rl-label">Accounts</h2>
              {accounts.length === 0 ? (
                <p className="mt-3 text-sm text-rl_muted">No accounts yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {accounts.slice(0, 6).map((account) => (
                    <li key={account.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-rl_textSecondary">
                        {account.platform} · {account.handle || account.displayName}
                      </span>
                      {connectionIssues.some((item) => item.id === account.id) ? (
                        <Link to="/accounts" className="text-xs text-rl_danger">Reconnect</Link>
                      ) : (
                        <span className="text-xs text-rl_muted">OK</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              <h2 className="rl-label mt-8">Upcoming</h2>
              {upcoming.length === 0 ? (
                <p className="mt-3 text-sm text-rl_muted">Nothing scheduled ahead.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {upcoming.map((item) => (
                    <li key={item.id}>
                      <Link to={`/content/${item.id}`} className="text-sm hover:underline">
                        {item.title || "Untitled"}
                        <span className="ml-2 text-xs text-rl_muted">{formatStamp(item.scheduledAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}
    </PageShell>
  );
}
