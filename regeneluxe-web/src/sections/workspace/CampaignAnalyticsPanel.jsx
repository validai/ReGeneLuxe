import { Link } from "@/nav";
import { analyzeCampaign, proposeIteration, persistProposedDecision } from "../../data/ai/campaignBrain.js";
import { analyzeCampaignChannels } from "../../data/ai/channelIntelligence.js";
import ResultsPanel from "./ResultsPanel.jsx";

export default function CampaignAnalyticsPanel({ campaign, accounts, snapshots, content }) {
  const analysis = analyzeCampaign(campaign, accounts);
  const channels = analyzeCampaignChannels(campaign, accounts);
  const campaignSnaps = snapshots.filter((item) => item.campaignId === campaign.id || content.some((entry) => entry.id === item.contentId && entry.campaignId === campaign.id));
  const campaignContent = content.filter((item) => item.campaignId === campaign.id);
  const published = campaignContent.filter((item) => item.status === "PUBLISHED");

  const leaderboard = campaignContent.map((item) => {
    const related = campaignSnaps.filter((snap) => snap.contentId === item.id);
    const score = related.reduce((sum, snap) => {
      return sum + Object.values(snap.metrics || {}).reduce((inner, value) => {
        const number = Number(value);
        return inner + (Number.isNaN(number) ? 0 : number);
      }, 0);
    }, 0);
    return { item, score, snapshots: related.length };
  }).sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6">
      <section className="rl-panel p-5">
        <p className="text-[11px] uppercase tracking-[0.16em] text-rl_muted">Goals</p>
        <p className="mt-2 text-sm">{(campaign.intake?.goals || []).join(", ") || "No goals selected."}</p>
        <p className="mt-3 text-xs text-rl_muted">
          {analysis.available
            ? `${analysis.snapshotCount} recorded snapshots · ${published.length} published`
            : analysis.reason}
        </p>
        <button
          type="button"
          className="rl-btn-ghost mt-3"
          onClick={() => {
            const result = proposeIteration(campaign, snapshots);
            if (result.available) persistProposedDecision(result.decision);
          }}
        >
          Explain what changed
        </button>
      </section>

      {channels.channels.length > 0 && (
        <section className="grid gap-3 md:grid-cols-2">
          {channels.channels.map((channel) => (
            <div key={channel.accountId} className="rl-panel p-4 text-sm">
              <p className="font-medium">{channel.handle}</p>
              <p className="text-xs text-rl_muted">{channel.platform} · {channel.connection}</p>
              <ul className="mt-2 space-y-1 text-xs text-rl_muted">
                {channel.findings.map((finding) => <li key={finding}>{finding}</li>)}
              </ul>
            </div>
          ))}
        </section>
      )}

      {leaderboard.some((entry) => entry.snapshots > 0) && (
        <section className="rl-panel p-4">
          <p className="text-[11px] uppercase tracking-[0.16em] text-rl_muted">Content leaderboard</p>
          <ul className="mt-3 space-y-2 text-sm">
            {leaderboard.filter((entry) => entry.snapshots > 0).slice(0, 8).map((entry) => (
              <li key={entry.item.id} className="flex justify-between gap-3">
                <Link to={`/content/${entry.item.id}`} className="hover:underline">{entry.item.title || "Untitled"}</Link>
                <span className="text-xs text-rl_muted">{entry.score} recorded · {entry.snapshots} snap{entry.snapshots === 1 ? "" : "s"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {campaignSnaps.length > 0 && (
        <ul className="space-y-2">
          {campaignSnaps.map((snap) => (
            <li key={snap.id} className="rl-panel p-4 text-sm">
              <p className="text-xs text-rl_muted">{snap.source} · {snap.platform}</p>
              <p className="mt-1">{Object.entries(snap.metrics || {}).filter(([, value]) => value != null && value !== "").map(([key, value]) => `${key} ${value}`).join(" · ") || "No populated metrics"}</p>
            </li>
          ))}
        </ul>
      )}
      <ResultsPanel campaign={campaign} accounts={accounts} />
    </div>
  );
}
