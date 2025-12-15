// FILE: src/pages/Dashboard.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import DashboardShell from "../components/dashboard/MissionLayout/DashboardShell";
import OverviewPane from "../sections/dashboard/OverviewPane";
import PerformancePane from "../sections/dashboard/PerformancePane";
import ControlsPane from "../sections/dashboard/ControlsPane";
import CampaignSettingsPane from "../sections/dashboard/CampaignSettingsPane";

import { Analytics } from "../utils/analytics";
import { EVENTS } from "../utils/analyticsEvents";
import { getActiveCampaign, getAllCampaigns } from "../utils/campaignStore";

// --- Empty-state scaffold shown ONLY when:
//     1) activeView === "dashboard"
//     2) there is NO active campaign
function EmptyDashboardScaffold({ onBeginQuestionnaire, onOpenBlueprint }) {
  return (
    <div className="space-y-6">
      <section className="rl-panel-roomy space-y-4">
        <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
          <div>
            <p className="text-[11px] font-semibold tracking-[0.26em] text-rl_muted/80 uppercase">
              No active campaign yet
            </p>
            <p className="mt-1 text-sm text-rl_text">
              Launch your first ReGeneLuxe campaign.
            </p>
            <p className="mt-1 text-[11px] text-rl_muted/80">
              Start by completing the questionnaire and blueprint. Once you
              launch, this dashboard becomes your RGL Engine for every
              campaign decision.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onBeginQuestionnaire}
              className="inline-flex items-center justify-center rounded-full bg-rl_accent px-5 py-2 text-[11px] font-semibold tracking-[0.22em] text-rl_bg shadow-rl_soft hover:shadow-md hover:-translate-y-[1px] transition-all"
            >
              BEGIN QUESTIONNAIRE
            </button>
            <button
              type="button"
              onClick={onOpenBlueprint}
              className="inline-flex items-center justify-center rounded-full border border-rl_border/70 bg-transparent px-5 py-2 text-[11px] font-semibold tracking-[0.22em] text-rl_muted hover:border-rl_accent/80 hover:text-rl_text transition-all"
            >
              OPEN BLUEPRINT
            </button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,2fr)_minmax(0,1.6fr)] pt-4 border-t border-rl_border/20">
          {/* Key performance metrics placeholder */}
          <div className="rounded-2xl border border-rl_border/30 bg-rl_surfaceSoft px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-rl_muted/75 uppercase">
              Key performance metrics
            </p>
            <p className="mt-1 text-[11px] text-rl_muted/80">
              Once your first campaign goes live, this tile will track views,
              conversions, and blended CPA.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-[11px]">
              {["Views", "Conversions", "Blended CPA"].map(label => (
                <div
                  key={label}
                  className="rounded-xl border border-rl_border/30 bg-rl_surface px-2 py-2"
                >
                  <div className="text-[10px] uppercase tracking-[0.22em] text-rl_muted/70">
                    {label}
                  </div>
                  <div className="mt-2 text-lg font-semibold text-rl_text">0</div>
                  <div className="mt-1 text-[10px] text-rl_muted/75">
                    No data yet
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule & pacing placeholder */}
          <div className="rounded-2xl border border-rl_border/30 bg-rl_surfaceSoft px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-rl_muted/75 uppercase">
              Schedule &amp; pacing
            </p>
            <p className="mt-1 text-[11px] text-rl_muted/80">
              Flight dates, countdown, and pacing status will appear here once a
              campaign is scheduled.
            </p>
            <dl className="mt-4 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <dt className="text-rl_muted/80">Launch date</dt>
                <dd className="text-rl_text">Not scheduled</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-rl_muted/80">Projected end</dt>
                <dd className="text-rl_text">Not scheduled</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-rl_muted/80">Days remaining</dt>
                <dd className="text-rl_text">—</dd>
              </div>
            </dl>
          </div>

          {/* Campaign controls placeholder */}
          <div className="rounded-2xl border border-rl_border/30 bg-rl_surfaceSoft px-4 py-3">
            <p className="text-[11px] font-semibold tracking-[0.26em] text-rl_muted/75 uppercase">
              Campaign controls
            </p>
            <p className="mt-1 text-[11px] text-rl_muted/80">
              Quick actions to pause, resume, or duplicate a campaign will unlock
              once you have at least one live campaign.
            </p>
            <div className="mt-4 space-y-2 text-[11px]">
              {["Pause campaign", "Resume campaign", "Duplicate as new test"].map(
                label => (
                  <button
                    key={label}
                    type="button"
                    disabled
                    className="flex w-full items-center justify-between rounded-full border border-rl_border/30 bg-rl_surface px-3 py-2 text-left text-rl_muted/70 cursor-not-allowed"
                  >
                    <span>{label}</span>
                    <span className="text-[9px] uppercase tracking-[0.2em]">
                      Locked
                    </span>
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-rl_border/20">
          <p className="font-semibold tracking-[0.26em] text-rl_muted/75 uppercase text-[11px]">
            Once you&apos;re live
          </p>
          <p className="mt-1 text-[11px] text-rl_muted/80">
            This dashboard will evolve into a full RGL Engine view: trajectory
            charts, channel mix, heatmaps, and AI tuning suggestions. For now, your
            next step is to create your first campaign via the questionnaire and
            blueprint.
          </p>
        </div>
      </section>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState("dashboard"); // "dashboard" | "analytics" | "audience" | "settings"
  const activeCampaign = getActiveCampaign();
  const allCampaigns = getAllCampaigns();
  const hasCampaign = !!activeCampaign;

  const pastCampaigns = activeCampaign
    ? allCampaigns.filter(c => c.id !== activeCampaign.id)
    : allCampaigns;

  useEffect(() => {
    Analytics.track(EVENTS.DASHBOARD_VIEW, {});
  }, []);

  const handleBeginQuestionnaire = () => {
    navigate("/start");
  };

  const handleOpenBlueprint = () => {
    navigate("/campaign/new");
  };

  return (
    <DashboardShell
      activeView={activeView}
      onViewChange={setActiveView}
      hasCampaign={hasCampaign}
      activeCampaign={activeCampaign}
    >
      {activeView === "dashboard" && (
        hasCampaign ? (
          <>
            {/* Past campaigns */}
            {pastCampaigns.length > 0 && (
              <section className="rl-panel-roomy">
                <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-rl_muted mb-4">
                  Past campaigns
                </h2>
                <div className="space-y-2">
                  {pastCampaigns.map(campaign => {
                    const views = campaign.metrics?.views28d || 0;
                    const conversions = campaign.metrics?.conversions28d || 0;
                    const cpa = campaign.metrics?.blendedCpa || 0;

                    return (
                      <div
                        key={campaign.id}
                        className="flex items-center justify-between rounded-xl bg-rl_surfaceSoft border border-rl_border/30 px-4 py-3 text-xs"
                      >
                        <div>
                          <p className="font-medium text-rl_text">{campaign.name}</p>
                          <p className="text-rl_muted mt-0.5">
                            {campaign.status || "completed"} ·{" "}
                            {new Date(campaign.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex gap-6">
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-rl_muted">
                              Views 28d
                            </p>
                            <p className="text-sm text-rl_text">{Number(views) || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-rl_muted">
                              Conversions 28d
                            </p>
                            <p className="text-sm text-rl_text">{Number(conversions) || 0}</p>
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.16em] text-rl_muted">
                              Blended CPA
                            </p>
                            <p className="text-sm text-rl_text">
                              {cpa ? `$${Number(cpa).toFixed(2)}` : "$0.00"}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            <OverviewPane />
          </>
        ) : (
          <EmptyDashboardScaffold
            onBeginQuestionnaire={handleBeginQuestionnaire}
            onOpenBlueprint={handleOpenBlueprint}
          />
        )
      )}

      {activeView === "analytics" && (
        <PerformancePane />
      )}

      {activeView === "audience" && (
        <ControlsPane />
      )}

      {activeView === "settings" && (
        <CampaignSettingsPane />
      )}
    </DashboardShell>
  );
}
