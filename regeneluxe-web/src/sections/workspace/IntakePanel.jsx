import { useEffect, useRef, useState } from "react";
import CheckboxGroup from "../../components/choices/CheckboxGroup.jsx";
import RadioGroup from "../../components/choices/RadioGroup.jsx";
import SectionPanel from "../../components/choices/SectionPanel.jsx";
import AutosaveIndicator from "../../components/choices/AutosaveIndicator.jsx";
import { updateCampaign } from "../../data/campaignRepository.js";
import { mergeIntake } from "../../data/models.js";
import { campaignCompleteness } from "../../data/campaignContext.js";
import {
  GOAL_OPTIONS,
  CONTENT_TYPE_OPTIONS,
  AUDIENCE_RELATIONSHIP_OPTIONS,
  AGE_RANGE_OPTIONS,
  GEOGRAPHY_OPTIONS,
  INTEREST_OPTIONS,
  FORMAT_OPTIONS,
  TONE_OPTIONS,
  VISUAL_OPTIONS,
  CTA_OPTIONS,
  MESSAGE_THEME_OPTIONS,
  STRATEGY_OPTIONS,
  AVAILABLE_ASSET_OPTIONS,
  CONSTRAINT_OPTIONS,
  SUCCESS_SIGNAL_OPTIONS,
  TESTING_OPTIONS,
  INTAKE_NAV,
} from "../../data/options.js";
import { PLATFORMS as PLATFORM_LIST } from "../../data/models.js";
import { fieldClass } from "../../components/app/FormField.jsx";

const ESSENTIAL_SECTION_IDS = ["purpose", "content", "audience"];

export default function IntakePanel({ campaign, accounts, essentialsOnly = false }) {
  const [intake, setIntake] = useState(() => mergeIntake(campaign.intake));
  const [saveState, setSaveState] = useState("saved");
  const [section, setSection] = useState("purpose");
  const [showAllSections, setShowAllSections] = useState(!essentialsOnly);
  const skip = useRef(true);
  const campaignMeta = useRef({ name: campaign.name, objective: campaign.objective });
  const visibleNav = showAllSections
    ? INTAKE_NAV
    : INTAKE_NAV.filter((item) => ESSENTIAL_SECTION_IDS.includes(item.id));
  const sectionVisible = (id) => showAllSections || ESSENTIAL_SECTION_IDS.includes(id);

  const patch = (partial) => {
    setSaveState("saving");
    setIntake((prev) => mergeIntake(prev, partial));
  };

  useEffect(() => {
    campaignMeta.current = { name: campaign.name, objective: campaign.objective };
  }, [campaign.name, campaign.objective]);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      return undefined;
    }
    const timer = setTimeout(() => {
      const nextName = campaignMeta.current.name === "Untitled campaign" && intake.promoted.title
        ? intake.promoted.title
        : campaignMeta.current.name;
      updateCampaign(campaign.id, {
        intake,
        accountIds: intake.accountIds,
        name: nextName,
        objective: intake.promoted.title || campaignMeta.current.objective,
      });
      setSaveState("saved");
    }, 400);
    return () => clearTimeout(timer);
  }, [intake, campaign.id]);

  const completeness = campaignCompleteness({ ...campaign, intake, accountIds: intake.accountIds });
  const groupedAccounts = PLATFORM_LIST.reduce((acc, platform) => {
    const items = accounts.filter((account) => account.platform === platform);
    if (items.length) acc.push([platform, items]);
    return acc;
  }, []);

  const scrollTo = (id) => {
    setSection(id);
    document.getElementById(`intake-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="text-[11px] uppercase tracking-[0.18em] text-rl_muted">Definition {completeness.percent}%</p>
        <nav className="mt-3 space-y-1" aria-label="Intake sections">
          {visibleNav.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={`block w-full rounded-md px-2 py-1.5 text-left text-xs ${
                section === item.id ? "bg-rl_surfaceSoft text-rl_text" : "text-rl_muted hover:text-rl_text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
        {essentialsOnly && !showAllSections && (
          <button
            type="button"
            className="mt-3 text-left text-[11px] uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
            onClick={() => setShowAllSections(true)}
          >
            Show all sections
          </button>
        )}
        <div className="mt-4">
          <AutosaveIndicator state={saveState} />
        </div>
      </aside>

      <div className="space-y-8">
        <SectionPanel id="intake-purpose" title="Campaign purpose" question="What is this campaign trying to accomplish?">
          <CheckboxGroup
            options={GOAL_OPTIONS}
            values={intake.goals}
            onChange={(goals) => patch({ goals })}
            otherText={intake.goalsOther}
            onOtherText={(goalsOther) => patch({ goalsOther })}
          />
        </SectionPanel>

        <SectionPanel id="intake-content" title="What are we promoting?" question="Name the release or content.">
          <RadioGroup
            legend="Primary content type"
            name="primary-content"
            options={CONTENT_TYPE_OPTIONS}
            value={intake.promoted.primary}
            onChange={(primary) => patch({ promoted: { primary } })}
            otherText={intake.promoted.other}
            onOtherText={(other) => patch({ promoted: { other } })}
          />
          <div className="pt-4">
            <CheckboxGroup
              legend="Supporting types"
              options={CONTENT_TYPE_OPTIONS.filter((option) => option.value !== "other")}
              values={intake.promoted.supporting}
              onChange={(supporting) => patch({ promoted: { supporting } })}
            />
          </div>
          <div className="grid gap-3 pt-4 md:grid-cols-2">
            <label className="text-xs text-rl_muted">
              Title / name
              <input className={`${fieldClass} mt-1`} value={intake.promoted.title} onChange={(e) => patch({ promoted: { title: e.target.value } })} />
            </label>
            <label className="text-xs text-rl_muted">
              Release / content URL
              <input className={`${fieldClass} mt-1`} value={intake.promoted.url} onChange={(e) => patch({ promoted: { url: e.target.value } })} />
            </label>
            <label className="text-xs text-rl_muted">
              Release date
              <input type="date" className={`${fieldClass} mt-1`} value={intake.promoted.releaseDate} onChange={(e) => patch({ promoted: { releaseDate: e.target.value } })} />
            </label>
            <label className="text-xs text-rl_muted md:col-span-2">
              Short description
              <textarea className={`${fieldClass} mt-1`} rows={2} value={intake.promoted.description} onChange={(e) => patch({ promoted: { description: e.target.value } })} />
            </label>
          </div>
        </SectionPanel>

        <SectionPanel id="intake-audience" title="Target audience" question="Who should this reach?">
          <CheckboxGroup legend="Audience relationship" options={AUDIENCE_RELATIONSHIP_OPTIONS} values={intake.audience.relationships} onChange={(relationships) => patch({ audience: { relationships } })} />
          <div className="pt-4">
            <CheckboxGroup legend="Age ranges" options={AGE_RANGE_OPTIONS} values={intake.audience.ageRanges} onChange={(ageRanges) => patch({ audience: { ageRanges } })} columns={2} />
          </div>
          <div className="pt-4">
            <CheckboxGroup
              legend="Geography"
              options={GEOGRAPHY_OPTIONS}
              values={intake.audience.geography}
              onChange={(geography) => patch({ audience: { geography } })}
              otherValue="custom"
              otherText={intake.audience.geographyCustom}
              onOtherText={(geographyCustom) => patch({ audience: { geographyCustom } })}
            />
          </div>
          <div className="pt-4">
            <CheckboxGroup
              legend="Interests"
              options={INTEREST_OPTIONS}
              values={intake.audience.interests}
              onChange={(interests) => patch({ audience: { interests } })}
              otherText={intake.audience.interestsOther}
              onOtherText={(interestsOther) => patch({ audience: { interestsOther } })}
            />
            <label className="mt-3 block text-xs text-rl_muted">
              Custom tags
              <input
                className={`${fieldClass} mt-1`}
                value={(intake.audience.interestTags || []).join(", ")}
                onChange={(e) => patch({ audience: { interestTags: e.target.value.split(",").map((item) => item.trim()).filter(Boolean) } })}
              />
            </label>
          </div>
        </SectionPanel>

        {sectionVisible("accounts") && (
          <SectionPanel id="intake-accounts" title="Platforms / accounts" question="Which of your accounts should participate?">
            {accounts.length === 0 ? (
              <p className="text-sm text-rl_muted">Add accounts first, or pick platforms below.</p>
            ) : (
              <div className="space-y-4">
                {groupedAccounts.map(([platform, items]) => (
                  <div key={platform}>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-rl_muted">{platform}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((account) => {
                        const checked = intake.accountIds.includes(account.id);
                        return (
                          <label key={account.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${checked ? "border-rl_accent bg-rl_accent/10 text-rl_text" : "border-rl_border bg-rl_bg text-rl_muted"}`}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-rl_accent"
                              checked={checked}
                              onChange={() => {
                                const next = new Set(intake.accountIds);
                                if (next.has(account.id)) next.delete(account.id);
                                else next.add(account.id);
                                patch({ accountIds: [...next] });
                              }}
                            />
                            <span>{account.handle || account.displayName}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-4">
              <CheckboxGroup
                legend="Platform-only targets"
                options={PLATFORM_LIST.map((platform) => ({ value: platform, label: platform }))}
                values={intake.platformTargets}
                onChange={(platformTargets) => patch({ platformTargets })}
              />
            </div>
          </SectionPanel>
        )}

        {sectionVisible("formats") && (
          <SectionPanel id="intake-formats" title="Content formats" question="What formats will this campaign use?">
            <CheckboxGroup options={FORMAT_OPTIONS} values={intake.contentFormats} onChange={(contentFormats) => patch({ contentFormats })} otherText={intake.contentFormatsOther} onOtherText={(contentFormatsOther) => patch({ contentFormatsOther })} />
          </SectionPanel>
        )}

        {sectionVisible("creative") && (
          <SectionPanel id="intake-creative" title="Creative direction" question="How should this feel?">
            <CheckboxGroup legend="Tone" options={TONE_OPTIONS} values={intake.creative.tone} onChange={(tone) => patch({ creative: { tone } })} otherText={intake.creative.toneOther} onOtherText={(toneOther) => patch({ creative: { toneOther } })} />
            <div className="pt-4">
              <CheckboxGroup legend="Visual style" options={VISUAL_OPTIONS} values={intake.creative.visual} onChange={(visual) => patch({ creative: { visual } })} otherText={intake.creative.visualOther} onOtherText={(visualOther) => patch({ creative: { visualOther } })} />
            </div>
          </SectionPanel>
        )}

        {sectionVisible("message") && (
          <SectionPanel id="intake-message" title="Message / CTA" question="What should people do?">
            <RadioGroup legend="Primary CTA" name="cta" options={CTA_OPTIONS} value={intake.messaging.cta} onChange={(cta) => patch({ messaging: { cta } })} otherText={intake.messaging.ctaCustom} onOtherText={(ctaCustom) => patch({ messaging: { ctaCustom } })} />
            <div className="pt-4">
              <CheckboxGroup legend="Key-message themes" options={MESSAGE_THEME_OPTIONS} values={intake.messaging.themes} onChange={(themes) => patch({ messaging: { themes } })} otherText={intake.messaging.themesOther} onOtherText={(themesOther) => patch({ messaging: { themesOther } })} />
            </div>
            <label className="mt-4 block text-xs text-rl_muted">
              Custom key message
              <textarea className={`${fieldClass} mt-1`} rows={2} value={intake.messaging.keyMessage} onChange={(e) => patch({ messaging: { keyMessage: e.target.value } })} />
            </label>
          </SectionPanel>
        )}

        {sectionVisible("strategy") && (
          <SectionPanel id="intake-strategy" title="Campaign strategy" question="How will this run?">
            <CheckboxGroup options={STRATEGY_OPTIONS} values={intake.strategy} onChange={(strategy) => patch({ strategy })} otherText={intake.strategyOther} onOtherText={(strategyOther) => patch({ strategyOther })} />
          </SectionPanel>
        )}

        {sectionVisible("assets") && (
          <SectionPanel id="intake-assets" title="Available assets" question="What do you already have?">
            <CheckboxGroup options={AVAILABLE_ASSET_OPTIONS} values={intake.availableAssets} onChange={(availableAssets) => patch({ availableAssets })} otherText={intake.availableAssetsOther} onOtherText={(availableAssetsOther) => patch({ availableAssetsOther })} />
            <label className="mt-4 block text-xs text-rl_muted">
              Anything else?
              <textarea className={`${fieldClass} mt-1`} rows={2} value={intake.availableAssetsNotes} onChange={(e) => patch({ availableAssetsNotes: e.target.value })} />
            </label>
          </SectionPanel>
        )}

        {sectionVisible("constraints") && (
          <SectionPanel id="intake-constraints" title="Constraints" question="What limits this campaign?">
            <CheckboxGroup options={CONSTRAINT_OPTIONS} values={intake.constraints} onChange={(constraints) => patch({ constraints })} otherText={intake.constraintsOther} onOtherText={(constraintsOther) => patch({ constraintsOther })} />
            <label className="mt-4 block text-xs text-rl_muted">
              Additional constraints
              <textarea className={`${fieldClass} mt-1`} rows={2} value={intake.constraintsNotes} onChange={(e) => patch({ constraintsNotes: e.target.value })} />
            </label>
          </SectionPanel>
        )}

        {sectionVisible("success") && (
          <SectionPanel id="intake-success" title="Success signals" question="How will you know it worked?">
            <RadioGroup legend="Primary success signal" name="success-primary" options={SUCCESS_SIGNAL_OPTIONS} value={intake.success.primary} onChange={(primary) => patch({ success: { primary } })} otherText={intake.success.other} onOtherText={(other) => patch({ success: { other } })} />
            {intake.success.primary && (
              <label className="mt-3 block text-xs text-rl_muted">
                Target value (optional)
                <input
                  className={`${fieldClass} mt-1`}
                  value={intake.success.targetValues?.[intake.success.primary] || ""}
                  onChange={(e) => patch({ success: { targetValues: { [intake.success.primary]: e.target.value } } })}
                />
              </label>
            )}
            <div className="pt-4">
              <CheckboxGroup legend="Secondary signals" options={SUCCESS_SIGNAL_OPTIONS.filter((option) => option.value !== "other")} values={intake.success.secondary} onChange={(secondary) => patch({ success: { secondary } })} />
            </div>
          </SectionPanel>
        )}

        {sectionVisible("testing") && (
          <SectionPanel id="intake-testing" title="Testing hypothesis" question="What is this campaign testing?">
            <CheckboxGroup options={TESTING_OPTIONS} values={intake.testing.hypotheses} onChange={(hypotheses) => patch({ testing: { hypotheses } })} otherText={intake.testing.other} onOtherText={(other) => patch({ testing: { other } })} />
            <label className="mt-4 block text-xs text-rl_muted">
              Hypothesis
              <textarea className={`${fieldClass} mt-1`} rows={2} placeholder="Short performance clips will produce more saves than visualizer clips." value={intake.testing.hypothesisText} onChange={(e) => patch({ testing: { hypothesisText: e.target.value } })} />
            </label>
          </SectionPanel>
        )}

        {sectionVisible("advanced") && (
          <details className="rounded-xl border border-rl_border bg-rl_bg px-4 py-3">
            <summary id="intake-advanced" className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-rl_muted">
              Advanced
            </summary>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["startDate", "Start date", "date"],
                ["endDate", "End date", "date"],
                ["budget", "Budget", "text"],
                ["timezone", "Timezone", "text"],
                ["postingFrequency", "Posting frequency", "text"],
                ["contentCadence", "Content cadence", "text"],
              ].map(([key, label, type]) => (
                <label key={key} className="text-xs text-rl_muted">
                  {label}
                  <input type={type} className={`${fieldClass} mt-1`} value={intake.advanced[key] || ""} onChange={(e) => patch({ advanced: { [key]: e.target.value } })} />
                </label>
              ))}
              {[
                ["geoNotes", "Geo targeting notes"],
                ["paidNotes", "Paid-media notes"],
                ["retargetingNotes", "Retargeting notes"],
                ["platformRestrictions", "Platform-specific restrictions"],
                ["internalNotes", "Internal notes"],
              ].map(([key, label]) => (
                <label key={key} className="text-xs text-rl_muted md:col-span-2">
                  {label}
                  <textarea className={`${fieldClass} mt-1`} rows={2} value={intake.advanced[key] || ""} onChange={(e) => patch({ advanced: { [key]: e.target.value } })} />
                </label>
              ))}
            </div>
          </details>
        )}

        {essentialsOnly && !showAllSections && (
          <button
            type="button"
            className="text-xs uppercase tracking-[0.14em] text-rl_muted hover:text-rl_text"
            onClick={() => setShowAllSections(true)}
          >
            Show all sections
          </button>
        )}
      </div>
    </div>
  );
}
