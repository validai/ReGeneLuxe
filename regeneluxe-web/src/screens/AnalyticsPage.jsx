import { useMemo, useState } from "react";
import { Link } from "@/nav";
import PageShell from "../components/app/PageShell.jsx";
import PageHeader from "../components/app/PageHeader.jsx";
import EmptyState from "../components/app/EmptyState.jsx";
import SegmentedControl from "../components/app/SegmentedControl.jsx";
import FormField, { fieldClass } from "../components/app/FormField.jsx";
import FilterBar from "../components/app/FilterBar.jsx";
import MetricCard from "../components/app/MetricCard.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { saveSnapshot } from "../data/collectionRepository.js";
import { ANALYTICS_METRICS } from "../data/domain.js";
import { buildAccountBaseline, compareAgainstBaseline, formatFactLine, platformTotals } from "../data/performanceCompare.js";
import { formatStamp, toDateKey } from "../utils/dates.js";

function metricLabel(key) {
  return String(key).replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function contentScore(metrics = {}) {
  const keys = ["engagementRate", "reach", "views", "impressions", "likes", "clicks", "comments", "shares"];
  return keys.reduce((sum, key) => {
    const value = Number(metrics[key]);
    return Number.isNaN(value) ? sum : sum + value;
  }, 0);
}

export default function AnalyticsPage() {
  const { snapshots, accounts, campaigns, content, workingAccountId } = useAppData();
  const [draft, setDraft] = useState({ accountId: "", campaignId: "", contentId: "", source: "MANUAL", metrics: {} });
  const [range, setRange] = useState("all");
  const [campaignId, setCampaignId] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [rangeAnchor] = useState(() => Date.now());

  const grouped = useMemo(() => {
    const cutoff = range === "7" ? rangeAnchor - 7 * 86400000 : range === "30" ? rangeAnchor - 30 * 86400000 : null;
    return snapshots
      .filter((snap) => {
        if (workingAccountId && snap.accountId !== workingAccountId) return false;
        if (campaignId && snap.campaignId !== campaignId) return false;
        if (cutoff && new Date(snap.recordedAt).getTime() < cutoff) return false;
        return true;
      })
      .slice()
      .sort((a, b) => String(b.recordedAt).localeCompare(String(a.recordedAt)));
  }, [snapshots, range, workingAccountId, campaignId, rangeAnchor]);

  const summary = useMemo(() => {
    const totals = {};
    const byContent = {};
    grouped.forEach((snap) => {
      if (snap.contentId) {
        byContent[snap.contentId] = byContent[snap.contentId] || { score: 0, snaps: 0, metrics: {} };
        byContent[snap.contentId].snaps += 1;
        byContent[snap.contentId].score += contentScore(snap.metrics);
        Object.entries(snap.metrics || {}).forEach(([key, value]) => {
          const number = Number(value);
          if (Number.isNaN(number)) return;
          byContent[snap.contentId].metrics[key] = (byContent[snap.contentId].metrics[key] || 0) + number;
        });
      }
      Object.entries(snap.metrics || {}).forEach(([key, value]) => {
        if (value == null || value === "") return;
        const number = Number(value);
        if (Number.isNaN(number)) return;
        totals[key] = (totals[key] || 0) + number;
      });
    });

    const preferred = ["engagementRate", "reach", "views", "impressions", "likes", "clicks"];
    const topMetrics = preferred
      .filter((key) => totals[key] != null)
      .concat(Object.keys(totals).filter((key) => !preferred.includes(key)))
      .slice(0, 4)
      .map((key) => [key, totals[key]]);

    const topContent = Object.entries(byContent)
      .sort((a, b) => b[1].score - a[1].score)
      .slice(0, 6)
      .map(([id, data]) => ({
        id,
        score: data.score,
        snaps: data.snaps,
        title: content.find((item) => item.id === id)?.title || id,
        reach: data.metrics.reach ?? data.metrics.views ?? data.metrics.impressions ?? null,
        engagement: data.metrics.engagementRate ?? data.metrics.likes ?? null,
      }));

    const channels = Object.entries(platformTotals(grouped)).map(([platform, data]) => {
      const metricSum = Object.values(data.metrics || {}).reduce((sum, value) => sum + Number(value || 0), 0);
      return { platform, count: data.count, metricSum, metrics: data.metrics };
    }).sort((a, b) => b.metricSum - a.metricSum);

    return {
      topMetrics,
      topContent,
      channels,
      freshness: grouped[0]?.recordedAt || null,
      source: grouped[0]?.source || null,
    };
  }, [grouped, content]);

  const factLines = useMemo(() => {
    if (!grouped.length) return [];
    const accountId = workingAccountId || grouped[0]?.accountId;
    if (!accountId) return [];
    const accountSnaps = snapshots.filter((snap) => snap.accountId === accountId);
    const baseline = buildAccountBaseline(accountSnaps);
    if (!baseline.available) return [];
    const compared = compareAgainstBaseline(grouped[0]?.metrics || {}, baseline);
    if (!compared.available) return [];
    return compared.comparisons.map(formatFactLine).filter(Boolean).slice(0, 3);
  }, [grouped, snapshots, workingAccountId]);

  const metricDeltas = useMemo(() => {
    const accountId = workingAccountId || grouped[0]?.accountId;
    if (!accountId || !grouped[0]) return {};
    const baseline = buildAccountBaseline(snapshots.filter((snap) => snap.accountId === accountId));
    if (!baseline.available) return {};
    const compared = compareAgainstBaseline(grouped[0].metrics || {}, baseline);
    const map = {};
    (compared.comparisons || []).forEach((entry) => {
      if (entry.classification === "INSUFFICIENT_DATA") return;
      map[entry.key] = Math.round((entry.relative || 0) * 100);
    });
    return map;
  }, [grouped, snapshots, workingAccountId]);

  const interpretation = useMemo(() => {
    if (!grouped.length) return "";
    const parts = [];
    if (factLines[0]) parts.push(factLines[0].replace(/\.$/, ""));
    if (summary.channels[0]) {
      parts.push(`${summary.channels[0].platform} leads on recorded volume in this range`);
    }
    if (summary.topContent[0]) {
      parts.push(`“${summary.topContent[0].title}” is the strongest linked post`);
    }
    if (!parts.length) {
      return `Freshness ${summary.freshness ? formatStamp(summary.freshness) : "unknown"}; keep recording snapshots to surface clearer shifts.`;
    }
    return `${parts.join(". ")}.`;
  }, [grouped.length, factLines, summary]);

  const filtersActive = range !== "all" || Boolean(campaignId);
  const maxChannel = Math.max(...summary.channels.map((item) => item.metricSum), 1);

  return (
    <PageShell>
      <PageHeader title="Analytics" description="What happened. Missing values stay empty — never invented zeros." />

      <FilterBar
        showClear={filtersActive}
        onClear={() => {
          setRange("all");
          setCampaignId("");
        }}
      >
        <SegmentedControl
          ariaLabel="Date range"
          value={range}
          onChange={setRange}
          options={[
            { id: "all", label: "All time" },
            { id: "7", label: "7 days" },
            { id: "30", label: "30 days" },
          ]}
        />
        <select className="rl-input max-w-xs" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
          <option value="">All campaigns</option>
          {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
        </select>
      </FilterBar>

      {grouped.length === 0 ? (
        <EmptyState title="No analytics yet" body="Provider metrics appear after a real connection. You can record manual snapshots." />
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="rl-label">What changed</h2>
            <p className="mt-2 rl-meta">
              Source {summary.source || "—"}
              {summary.freshness ? ` · Freshness ${formatStamp(summary.freshness)}` : ""}
            </p>
            {factLines.length > 0 ? (
              <ul className="mt-3 space-y-1.5 text-sm text-rl_text">
                {factLines.map((line) => <li key={line}>{line}</li>)}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-rl_muted">Baselines appear after enough recorded snapshots.</p>
            )}
          </section>

          {summary.topMetrics.length > 0 && (
            <section>
              <h2 className="rl-label">Key metrics</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {summary.topMetrics.map(([key, value]) => (
                  <MetricCard
                    key={key}
                    label={metricLabel(key)}
                    value={value}
                    delta={metricDeltas[key]}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="rl-label">Best content</h2>
            {summary.topContent.length === 0 ? (
              <p className="mt-3 text-sm text-rl_muted">No content-linked snapshots.</p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-rl_border text-[11px] uppercase tracking-[0.12em] text-rl_muted">
                      <th className="py-2 font-semibold">Post</th>
                      <th className="py-2 font-semibold">Reach / views</th>
                      <th className="py-2 font-semibold">Engagement</th>
                      <th className="py-2 font-semibold">Snapshots</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-rl_border">
                    {summary.topContent.map((item) => (
                      <tr key={item.id}>
                        <td className="py-2.5">
                          <Link to={`/content/${item.id}`} className="hover:underline">{item.title}</Link>
                        </td>
                        <td className="py-2.5 tabular-nums text-rl_textSecondary">
                          {item.reach == null ? "—" : item.reach.toLocaleString()}
                        </td>
                        <td className="py-2.5 tabular-nums text-rl_textSecondary">
                          {item.engagement == null ? "—" : item.engagement.toLocaleString()}
                        </td>
                        <td className="py-2.5 tabular-nums text-rl_muted">{item.snaps}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section>
            <h2 className="rl-label">Channel comparison</h2>
            {summary.channels.length === 0 ? (
              <p className="mt-3 text-sm text-rl_muted">No platform coverage yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {summary.channels.map((channel) => {
                  const width = Math.max(4, Math.round((channel.metricSum / maxChannel) * 100));
                  return (
                    <li key={channel.platform}>
                      <div className="flex items-baseline justify-between gap-3 text-sm">
                        <span>{channel.platform}</span>
                        <span className="text-xs text-rl_muted">{channel.count} snapshot{channel.count === 1 ? "" : "s"}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-rl_surfaceSoft">
                        <div className="h-full rounded-full bg-rl_accent/70" style={{ width: `${width}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h2 className="rl-label">ReGeneLuxe interpretation</h2>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-rl_textSecondary">{interpretation}</p>
          </section>

          <section>
            <h2 className="rl-label">Snapshots</h2>
            <ul className="mt-3 divide-y divide-rl_border border-y border-rl_border">
              {grouped.map((snap) => (
                <li key={snap.id} className="py-3 text-sm">
                  <p className="rl-meta">
                    {snap.source} · {snap.platform || "Unknown platform"} · {formatStamp(snap.recordedAt)} · day {toDateKey(snap.recordedAt)}
                  </p>
                  <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
                    {Object.entries(snap.metrics || {}).filter(([, value]) => value != null && value !== "").map(([key, value]) => (
                      <div key={key} className="flex gap-1.5">
                        <dt className="text-rl_muted">{metricLabel(key)}</dt>
                        <dd className="tabular-nums">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        </div>
      )}

      <section className="border-t border-rl_border pt-6">
        <button
          type="button"
          className="rl-label hover:text-rl_text"
          onClick={() => setShowManual((value) => !value)}
          aria-expanded={showManual}
        >
          {showManual ? "Hide manual entry" : "Manual entry"}
        </button>
        {showManual && (
          <form
            className="mt-4 grid gap-3 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              const metrics = {};
              ANALYTICS_METRICS.forEach((key) => {
                const value = draft.metrics[key];
                metrics[key] = value === "" || value == null ? null : Number(value);
              });
              const account = accounts.find((item) => item.id === draft.accountId);
              saveSnapshot({
                ...draft,
                platform: account?.platform || "",
                metrics,
                source: "MANUAL",
                freshness: new Date().toISOString(),
              });
              setDraft({ accountId: "", campaignId: "", contentId: "", source: "MANUAL", metrics: {} });
            }}
          >
            <FormField id="snap-account" label="Account">
              <select id="snap-account" className={fieldClass} value={draft.accountId} onChange={(e) => setDraft({ ...draft, accountId: e.target.value })}>
                <option value="">Select</option>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.handle || account.displayName}</option>)}
              </select>
            </FormField>
            <FormField id="snap-campaign" label="Campaign">
              <select id="snap-campaign" className={fieldClass} value={draft.campaignId} onChange={(e) => setDraft({ ...draft, campaignId: e.target.value })}>
                <option value="">Optional</option>
                {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
              </select>
            </FormField>
            <FormField id="snap-content" label="Content">
              <select id="snap-content" className={fieldClass} value={draft.contentId} onChange={(e) => setDraft({ ...draft, contentId: e.target.value })}>
                <option value="">Optional</option>
                {content.map((item) => <option key={item.id} value={item.id}>{item.title || item.id}</option>)}
              </select>
            </FormField>
            <div className="grid grid-cols-2 gap-2 md:col-span-2 md:grid-cols-4">
              {ANALYTICS_METRICS.map((key) => (
                <label key={key} className="text-xs text-rl_muted">
                  {metricLabel(key)}
                  <input className={`${fieldClass} mt-1`} inputMode="decimal" value={draft.metrics[key] ?? ""} onChange={(e) => setDraft({ ...draft, metrics: { ...draft.metrics, [key]: e.target.value } })} />
                </label>
              ))}
            </div>
            <button type="submit" className="rl-btn">Record snapshot</button>
          </form>
        )}
      </section>
    </PageShell>
  );
}
