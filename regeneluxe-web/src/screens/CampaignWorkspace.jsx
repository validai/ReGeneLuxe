import { useEffect, useMemo, useState } from "react";
import { Link, useAppNavigate as useNavigate, useAppParams as useParams, useAppSearchParams as useSearchParams } from "@/nav";
import Tabs from "../components/app/Tabs.jsx";
import ErrorState from "../components/app/ErrorState.jsx";
import Icon from "../components/app/Icon.jsx";
import { useAppData } from "../hooks/useAppData.js";
import { getActiveCampaignId, setActiveCampaignId, setCampaignActive, updateCampaign } from "../data/campaignRepository.js";
import { campaignCompleteness } from "../data/campaignContext.js";
import { CAMPAIGN_TABS } from "../data/domain.js";
import { sectionFromTab } from "../data/options.js";
import OverviewPanel from "../sections/workspace/OverviewPanel.jsx";
import StrategyPanel from "../sections/workspace/StrategyPanel.jsx";
import CampaignContentPanel from "../sections/workspace/CampaignContentPanel.jsx";
import CalendarBoard from "../components/calendar/CalendarBoard.jsx";
import CampaignAnalyticsPanel from "../sections/workspace/CampaignAnalyticsPanel.jsx";
import ResultsMeaningPanel from "../sections/workspace/ResultsMeaningPanel.jsx";
import { formatStamp } from "../utils/dates.js";
import { buildCampaignStateSnapshot } from "../data/campaignMonitor.js";

const TABS = CAMPAIGN_TABS.map((item) => ({ id: item.tab, label: item.label }));

export default function CampaignWorkspace() {
  const { campaignId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { campaigns, accounts, content, decisions, snapshots } = useAppData();
  const [editingName, setEditingName] = useState(false);

  const campaign = useMemo(
    () => campaigns.find((item) => item.id === campaignId) || null,
    [campaigns, campaignId]
  );

  const requested = params.get("tab");
  const tab = TABS.some((item) => item.id === requested) ? requested : "overview";

  useEffect(() => {
    if (campaign?.id && getActiveCampaignId() !== campaign.id) {
      setActiveCampaignId(campaign.id);
    }
  }, [campaign?.id]);

  useEffect(() => {
    if (!campaign?.id) return;
    const nextSection = sectionFromTab(tab);
    if (campaign.currentSection !== nextSection) {
      updateCampaign(campaign.id, { currentSection: nextSection });
    }
  }, [campaign?.id, campaign?.currentSection, tab]);

  if (!campaign) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <ErrorState
          title="Campaign not found"
          body="It may have been deleted or the link is stale."
          action={(
            <Link to="/campaigns" className="rl-btn-ghost">
              Back to campaigns
            </Link>
          )}
        />
      </div>
    );
  }

  const completeness = campaignCompleteness(campaign);
  const campaignContent = content.filter((item) => item.campaignId === campaign.id);
  const progress = buildCampaignStateSnapshot(campaign, { accounts, content, snapshots, decisions }).progressLabel;

  return (
    <div className="mx-auto max-w-workspace space-y-6 px-4 py-8 sm:px-6">
      <button
        type="button"
        onClick={() => navigate("/campaigns")}
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
      >
        <Icon name="back" size="sm" />
        Campaigns
      </button>

      <header className="flex flex-col gap-4 border-b border-rl_border pb-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          {editingName ? (
            <input
              className="rl-input mt-1 max-w-xl text-2xl font-semibold"
              value={campaign.name}
              autoFocus
              onChange={(e) => updateCampaign(campaign.id, { name: e.target.value })}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
            />
          ) : (
            <div className="mt-1 flex flex-wrap items-baseline gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-rl_text">{campaign.name}</h1>
              <button type="button" onClick={() => setEditingName(true)} className="text-[11px] uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text">
                Edit
              </button>
            </div>
          )}
          <p className="mt-2 text-sm text-rl_muted">{campaign.objective || campaign.intake?.promoted?.title || "No goal yet."}</p>
          <p className="mt-2 text-xs text-rl_muted">
            {progress} · Updated {formatStamp(campaign.updatedAt)}
            {tab === "strategy" ? ` · Strategy ${completeness.percent}%` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCampaignActive(campaign.id, !campaign.active)}
          className={`rounded-full px-5 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
            campaign.active ? "bg-rl_ok text-rl_bg" : "border border-rl_border text-rl_muted"
          }`}
          aria-pressed={campaign.active}
        >
          {campaign.active ? "Active" : "Inactive"}
        </button>
      </header>

      <Tabs tabs={TABS} value={tab} onChange={(next) => setParams({ tab: next }, { replace: true })} />

      <section className="pb-10">
        {tab === "overview" && <OverviewPanel campaign={campaign} accounts={accounts} content={content} decisions={decisions} />}
        {tab === "strategy" && <StrategyPanel campaign={campaign} accounts={accounts} />}
        {tab === "content" && <CampaignContentPanel campaign={campaign} content={content} />}
        {tab === "calendar" && <CalendarBoard items={campaignContent} accounts={accounts} campaigns={campaigns} />}
        {tab === "analytics" && <CampaignAnalyticsPanel campaign={campaign} accounts={accounts} snapshots={snapshots} content={content} />}
        {tab === "results" && <ResultsMeaningPanel campaign={campaign} />}
      </section>
    </div>
  );
}
