// src/sections/dashboard/CampaignSettingsPane.jsx
import { useState, useEffect } from "react";
import { getActiveCampaign, updateCampaignConfig, getActiveCampaignId } from "../../utils/campaignStore";
import { FiEdit2 } from "react-icons/fi";

const TARGETING_STYLE_LABELS = {
  demographic: "Demographic (age, gender, income)",
  geographic: "Geographic (countries, regions, radius)",
  behavioral: "Behavioral (site actions, history)",
  interest: "Interest / psychographic",
  contextual: "Contextual (page / content based)",
};

export default function CampaignSettingsPane() {
  const campaign = getActiveCampaign();
  const [isEditingName, setIsEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [localConfig, setLocalConfig] = useState(null);

  useEffect(() => {
    if (campaign) {
      setDraftName(campaign.name || "");
      setLocalConfig({
        targeting: campaign.targeting || { ageRange: { min: null, max: null }, locations: [], interests: "", targetingStyle: null },
        platforms: campaign.platforms || [],
        website: campaign.website || "",
        timezone: campaign.timezone || "",
        contactEmail: campaign.contactEmail || "",
        campaignLengthDays: campaign.campaignLengthDays || "",
        startDate: campaign.startDate || "",
        endDate: campaign.endDate || "",
      });
    }
  }, [campaign]);

  if (!campaign) {
    return (
      <section className="rl-panel-roomy text-center">
        <p className="font-medium text-rl_text">No active campaign yet.</p>
        <p className="mt-1 text-xs text-rl_muted/80">
          Start by completing the questionnaire and blueprint to configure your first campaign.
        </p>
      </section>
    );
  }

  if (!localConfig) return null;

  const activeId = getActiveCampaignId();
  const { onboarding = {}, blueprint = {} } = campaign;

  const handleSaveName = () => {
    if (activeId && draftName.trim()) {
      updateCampaignConfig(activeId, { name: draftName.trim() });
      setIsEditingName(false);
    }
  };

  const handleUpdateConfig = (updates) => {
    if (!activeId) return;
    const updated = updateCampaignConfig(activeId, updates);
    if (updated) {
      setLocalConfig((prev) => ({ ...prev, ...updates }));
    }
  };

  const handleUpdateTargeting = (updates) => {
    handleUpdateConfig({
      targeting: {
        ...localConfig.targeting,
        ...updates,
      },
    });
  };

  const ageRange = localConfig.targeting?.ageRange || {};
  const platformsText = Array.isArray(localConfig.platforms) ? localConfig.platforms.join(", ") : "";

  return (
    <div className="space-y-6">
      {/* Group A – Campaign identity */}
      <section className="rl-panel-roomy">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-[11px] uppercase tracking-[0.2em] text-rl_muted/70">
              Active campaign
            </p>
            <div className="mt-1 flex items-center gap-2">
              {isEditingName ? (
                <input
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                  className="min-w-[180px] rounded-md bg-rl_bg border border-rl_border px-2 py-1 text-sm text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                  autoFocus
                />
              ) : (
                <h2 className="text-sm font-semibold text-rl_text">
                  {campaign.name || "Untitled campaign"}
                </h2>
              )}
              <button
                type="button"
                onClick={() => setIsEditingName(true)}
                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-rl_border bg-rl_bg text-[11px] text-rl_muted hover:border-rl_accent hover:text-rl_accent transition-colors"
                aria-label="Edit campaign name"
              >
                <FiEdit2 className="text-xs" />
              </button>
            </div>
            {campaign.tierId && (
              <p className="mt-1 text-xs text-rl_muted">
                {campaign.tierId === "presidential" ? "Presidential" : campaign.tierId === "single-video" ? "Single Video" : "Signature blueprint tier"}
              </p>
            )}
          </div>
        </div>
        <p className="mt-3 text-[11px] text-rl_muted/70">
          Updates here become the source of truth for this campaign. Changes to live
          campaigns may take up to 24 hours to fully propagate across channels.
        </p>
      </section>

      {/* Group B – Audience & Targeting */}
      <section className="rl-panel-roomy">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-rl_muted mb-4">
          Audience & Targeting
        </h3>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-[11px] text-rl_muted mb-1.5">Age range</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="13"
                  max="99"
                  value={ageRange.min || ""}
                  onChange={(e) => handleUpdateTargeting({
                    ageRange: { ...ageRange, min: e.target.value ? Number(e.target.value) : null },
                  })}
                  placeholder="Min"
                  className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                />
                <span className="text-xs text-rl_muted">to</span>
                <input
                  type="number"
                  min="13"
                  max="99"
                  value={ageRange.max || ""}
                  onChange={(e) => handleUpdateTargeting({
                    ageRange: { ...ageRange, max: e.target.value ? Number(e.target.value) : null },
                  })}
                  placeholder="Max"
                  className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                />
              </div>
              {!ageRange.min && !ageRange.max && (
                <p className="mt-1 text-[10px] text-rl_muted/70">
                  Not set yet – we&apos;ll treat this as broad.
                </p>
              )}
            </div>

            <div>
              <label className="block text-[11px] text-rl_muted mb-1.5">Targeting style</label>
              <select
                value={localConfig.targeting?.targetingStyle || ""}
                onChange={(e) => handleUpdateTargeting({ targetingStyle: e.target.value || null })}
                className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              >
                <option value="">Not set</option>
                {Object.entries(TARGETING_STYLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Key locations to prioritise</label>
            <input
              type="text"
              value={Array.isArray(localConfig.targeting?.locations) ? localConfig.targeting.locations.join(", ") : ""}
              onChange={(e) => {
                const locations = e.target.value ? e.target.value.split(",").map(x => x.trim()).filter(Boolean) : [];
                handleUpdateTargeting({ locations });
              }}
              placeholder="e.g. US & Canada, UK + EU, DACH..."
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {(!localConfig.targeting?.locations || localConfig.targeting.locations.length === 0) && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                Not set yet – we&apos;ll treat this as global.
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Interests & intent signals</label>
            <textarea
              value={localConfig.targeting?.interests || ""}
              onChange={(e) => handleUpdateTargeting({ interests: e.target.value })}
              rows={2}
              placeholder="Hobbies, behaviours, keywords..."
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {!localConfig.targeting?.interests && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                Not set yet – we&apos;ll use broad interest targeting.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Group C – Channels & Platforms */}
      <section className="rl-panel-roomy">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-rl_muted mb-4">
          Connected channels for this campaign
        </h3>
        <ul className="mt-3 space-y-1 text-xs mb-4">
          {localConfig.platforms && localConfig.platforms.length > 0 ? (
            localConfig.platforms.map((p, idx) => (
              <li key={idx} className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-rl_accent" />
                <span className="text-rl_text/90">{p}</span>
              </li>
            ))
          ) : (
            <li className="text-rl_muted/70">
              No platforms set yet. Add at least one so we know where to deploy.
            </li>
          )}
        </ul>
        <div>
          <label className="block text-[11px] text-rl_muted mb-1.5">Edit platforms</label>
          <input
            type="text"
            value={platformsText}
            onChange={(e) => {
              const platforms = e.target.value ? e.target.value.split(",").map(p => p.trim()).filter(Boolean) : [];
              handleUpdateConfig({ platforms });
            }}
            placeholder="e.g. Meta Ads, TikTok, YouTube, Google Search, Email / CRM"
            className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
          />
        </div>
      </section>

      {/* Group D – Flight details */}
      <section className="rl-panel-roomy">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-rl_muted mb-4">
          Flight window & pacing
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Website / landing page</label>
            <input
              type="url"
              value={localConfig.website}
              onChange={(e) => handleUpdateConfig({ website: e.target.value })}
              placeholder="https://yourbrand.com"
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {!localConfig.website && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                {onboarding.website || "Not set yet"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Time zone</label>
            <input
              type="text"
              value={localConfig.timezone}
              onChange={(e) => handleUpdateConfig({ timezone: e.target.value })}
              placeholder="e.g. US / Canada – Eastern (ET)"
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {!localConfig.timezone && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                {onboarding.timezone || "Not specified"}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Campaign length (days)</label>
            <input
              type="number"
              min="1"
              value={localConfig.campaignLengthDays || ""}
              onChange={(e) => handleUpdateConfig({ campaignLengthDays: e.target.value ? Number(e.target.value) : null })}
              placeholder="e.g. 42"
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {localConfig.campaignLengthDays && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                {localConfig.campaignLengthDays} days
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">Start date</label>
            <input
              type="date"
              value={localConfig.startDate ? localConfig.startDate.split("T")[0] : ""}
              onChange={(e) => handleUpdateConfig({ startDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {!localConfig.startDate && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                Not scheduled yet
              </p>
            )}
          </div>

          <div>
            <label className="block text-[11px] text-rl_muted mb-1.5">End date</label>
            <input
              type="date"
              value={localConfig.endDate ? localConfig.endDate.split("T")[0] : ""}
              onChange={(e) => handleUpdateConfig({ endDate: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            {!localConfig.endDate && (
              <p className="mt-1 text-[10px] text-rl_muted/70">
                Not scheduled yet
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Group E – Contact & Owner */}
      <section className="rl-panel-roomy">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-rl_muted mb-4">
          Owner & notifications
        </h3>
        <div>
          <label className="block text-[11px] text-rl_muted mb-1.5">Contact email</label>
          <input
            type="email"
            value={localConfig.contactEmail}
            onChange={(e) => handleUpdateConfig({ contactEmail: e.target.value })}
            placeholder="you@brand.com"
            className="w-full rounded-md bg-rl_bg border border-rl_border px-2 py-1.5 text-xs text-rl_text placeholder:text-rl_muted/50 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
          />
          <p className="mt-1 text-[10px] text-rl_muted/70">
            We&apos;ll use this for approvals and critical alerts.
          </p>
        </div>
      </section>
    </div>
  );
}

