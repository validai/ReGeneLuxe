// src/components/BluePrintForm.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Analytics } from "../utils/analytics";

const TIMEZONES = [
  "US / Canada – Pacific (PT)",
  "US / Canada – Mountain (MT)",
  "US / Canada – Central (CT)",
  "US / Canada – Eastern (ET)",
  "UK / Ireland – GMT / BST",
  "Europe – CET / CEST",
  "Australia / NZ",
  "Other",
];

const MEDIA_BUDGET_RANGES = [
  "Under $5,000 / month",
  "$5,000 – $15,000 / month",
  "$15,000 – $50,000 / month",
  "$50,000 – $150,000 / month",
  "$150,000+ / month",
];

const PRIMARY_CHANNEL_OPTIONS = [
  "Meta (Facebook / Instagram)",
  "TikTok",
  "YouTube Ads",
  "Google Search / Performance Max",
  "LinkedIn",
  "Email",
  "SMS",
  "Other",
];

const CRM_OPTIONS = [
  "HubSpot",
  "Klaviyo",
  "Mailchimp",
  "Salesforce",
  "ActiveCampaign",
  "Custom / in-house",
  "Other",
];

const ANALYTICS_OPTIONS = [
  "GA4 + pixels",
  "Pixels only (Meta / TikTok / etc.)",
  "Server-side events configured",
  "Mixed / not sure",
];

export default function BluePrintForm({ tier, onSubmit }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [primaryChannels, setPrimaryChannels] = useState([]);
  const [regulated, setRegulated] = useState("");
  const isPresidential = tier?.id === "presidential";
  const isSingleVideo = tier?.id === "single-video";

  const toggleChannel = (value) => {
    setPrimaryChannels((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value]
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const blueprintData = {};
    formData.forEach((value, key) => {
      blueprintData[key] = value;
    });

    const campaignName =
      blueprintData.campaignName ||
      blueprintData.workingCampaignName ||
      blueprintData.campaignTitle ||
      "";

    // Extract targeting fields
    const ageMin = formData.get("targetAgeMin");
    const ageMax = formData.get("targetAgeMax");
    const targetingStyle = formData.get("targetingStyle") || null;
    const targetLocations = formData.get("targetLocations") || "";
    const targetInterests = formData.get("targetInterests") || "";
    const platformsRaw = formData.get("platforms") || "";
    const platforms = platformsRaw
      ? platformsRaw.split(",").map(p => p.trim()).filter(Boolean)
      : [];

    // Structure targeting data
    blueprintData.targeting = {
      ageRange: {
        min: ageMin ? Number(ageMin) : null,
        max: ageMax ? Number(ageMax) : null,
      },
      targetingStyle,
      locations: targetLocations ? targetLocations.split(",").map(x => x.trim()).filter(Boolean) : [],
      interests: targetInterests,
    };
    blueprintData.platforms = platforms;

    Analytics.track?.("blueprint_submit_attempt", {
      tier: tier?.id,
      hasCampaignName: Boolean(campaignName),
      fieldCount: Object.keys(blueprintData).length,
    });

    const done = () => {
      setIsSubmitting(false);
    };

    Promise.resolve(
      onSubmit
        ? onSubmit({
            tierId: tier?.id || null,
            campaignName,
            blueprintData,
          })
        : null
    )
      .then(() => {
        Analytics.track?.("blueprint_submit_success", {
          tier: tier?.id,
        });
      })
      .catch((error) => {
        console.error("Blueprint submit failed", error);
        Analytics.error?.("blueprint_submit_error", {
          message: error?.message,
        });
      })
      .finally(done);
  };

  const SectionShell = ({ step, title, eyebrow, children }) => (
    <section className="rounded-2xl border border-rl_border/70 bg-rl_surface/70 px-4 py-4 md:px-6 md:py-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-rl_bg text-[11px] font-semibold tracking-[0.18em] text-rl_muted uppercase">
          {String(step).padStart(2, "0")}
        </div>
        <div className="flex-1">
          <p className="text-[10px] font-semibold tracking-[0.24em] uppercase text-rl_muted">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-base font-semibold text-rl_text">
            {title}
          </h2>
          <div className="mt-3 space-y-4 text-sm text-rl_text">
            {children}
          </div>
        </div>
      </div>
    </section>
  );

  const chipBase =
    "inline-flex items-center justify-center rounded-full border px-3 py-1.5 text-xs font-medium transition-all";
  const chipSelected =
    "border-rl_accent bg-rl_accent/10 text-rl_accent shadow-[0_10px_25px_rgba(15,23,42,0.12)]";
  const chipUnselected =
    "border-rl_border bg-rl_surface text-rl_muted hover:border-rl_accent/70 hover:text-rl_text";

  const inputBase =
    "mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70";

  const labelBase = "block text-xs font-medium text-rl_muted";

  return (
    <form onSubmit={handleSubmit} className="space-y-6 text-sm">
      {/* 1. Brand & Point of Contact */}
      <SectionShell
        step={1}
        eyebrow="Brand & Contact"
        title="Who are we building this for?"
      >
        <p className="text-xs text-rl_muted">
          This is who we&apos;ll speak to in the work and who we send drafts
          to for approval.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelBase}>Your full name *</label>
            <input
              name="contactName"
              className={inputBase}
              placeholder="Jane Doe"
              required
            />
          </div>

          <div>
            <label className={labelBase}>Role / title</label>
            <input
              name="role"
              className={inputBase}
              placeholder="Founder, CMO, solo creator..."
            />
          </div>

          <div>
            <label className={labelBase}>Brand / company name</label>
            <input
              name="brandName"
              className={inputBase}
              placeholder="ReGeneLuxe Labs"
            />
          </div>

          <div>
            <label className={labelBase}>Best contact email *</label>
            <input
              name="email"
              type="email"
              className={inputBase}
              placeholder="you@brand.com"
              required
            />
          </div>

          <div>
            <label className={labelBase}>Website / main landing page</label>
            <input
              name="website"
              type="url"
              className={inputBase}
              placeholder="https://yourbrand.com"
            />
          </div>

          <div>
            <label className={labelBase}>Time zone</label>
            <select name="timezone" className={inputBase} defaultValue="">
              <option value="" disabled>
                Select a time zone
              </option>
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </SectionShell>

      {/* 2. Campaign Scope & Objectives */}
      <SectionShell
        step={2}
        eyebrow="Scope & Objectives"
        title="What does a win look like?"
      >
        <p className="text-xs text-rl_muted">
          This helps us design the blueprint around one clear success
          metric instead of vague &quot;better performance&quot;.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelBase}>Working campaign name</label>
            <input
              name="campaignName"
              className={inputBase}
              placeholder="Q1 Launch – Founders Edition"
              required
            />
          </div>

          <div>
            <label className={labelBase}>Primary objective *</label>
            <select
              name="primaryObjective"
              className={inputBase}
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select an objective
              </option>
              <option value="sales">Direct sales / purchases</option>
              <option value="leads">Leads / booked calls</option>
              <option value="awareness">Brand awareness</option>
              <option value="retention">
                Activation / retention of existing customers
              </option>
              <option value="community">Community / follower growth</option>
            </select>
          </div>

          <div>
            <label className={labelBase}>Success metric (one number)</label>
            <input
              name="successMetric"
              className={inputBase}
              placeholder="e.g. 300 sales in 30 days at $X CPA"
            />
          </div>

          <div>
            <label className={labelBase}>Ideal timeline</label>
            <input
              name="timeline"
              className={inputBase}
              placeholder="e.g. Start Jan 15, run for 90 days"
            />
          </div>

          <div>
            <label className={labelBase}>Monthly media budget (USD)</label>
            <select
              name="mediaBudget"
              className={inputBase}
              defaultValue=""
            >
              <option value="" disabled>
                Select a budget range
              </option>
              {MEDIA_BUDGET_RANGES.map((range) => (
                <option key={range} value={range}>
                  {range}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelBase}>Markets / regions to target</label>
            <input
              name="regions"
              className={inputBase}
              placeholder="e.g. US only, US + UK, DACH..."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelBase}>
            If this campaign fails, what will have gone wrong?
          </label>
          <textarea
            name="failureModes"
            rows={3}
            className={inputBase}
            placeholder="Be honest – this helps us design around real risks."
          />
        </div>
      </SectionShell>

      {/* 3. Offer & Product */}
      <SectionShell
        step={3}
        eyebrow="Offer"
        title="What are we actually selling?"
      >
        <p className="text-xs text-rl_muted">
          Describe the offer like we&apos;re your smartest customer, not an
          investor deck.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelBase}>
              What are you promoting in this campaign?
            </label>
            <textarea
              name="offer"
              rows={3}
              className={inputBase}
              placeholder="Product, service, bundle, event, subscription..."
            />
          </div>

          <div>
            <label className={labelBase}>Key outcome / promise</label>
            <input
              name="keyOutcome"
              className={inputBase}
              placeholder="e.g. 'Double your qualified demos in 60 days'"
            />
          </div>

          <div>
            <label className={labelBase}>Main price point and structure</label>
            <input
              name="pricePoint"
              className={inputBase}
              placeholder="e.g. $97/mo, $2,000 once, tiered pricing..."
            />
          </div>

          <div>
            <label className={labelBase}>Guarantees or risk reversals</label>
            <input
              name="guarantees"
              className={inputBase}
              placeholder="If any."
            />
          </div>

          <div>
            <label className={labelBase}>
              Upsells / cross-sells tied to this offer
            </label>
            <input
              name="upsells"
              className={inputBase}
              placeholder="We'll use this to design LTV-aware flows."
            />
          </div>
        </div>
      </SectionShell>

      {/* 4. Target Audience & Psychology */}
      <SectionShell
        step={4}
        eyebrow="Audience"
        title="Who are we persuading?"
      >
        <p className="text-xs text-rl_muted">
          The sharper we understand their world, the sharper the angles we
          can use.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className={labelBase}>Primary audience</label>
            <textarea
              name="audience"
              rows={3}
              className={inputBase}
              placeholder="Demographics, roles, industries, or creator niches."
            />
          </div>

          <div>
            <label className={labelBase}>Top 3 pains / frustrations</label>
            <textarea
              name="audiencePains"
              rows={3}
              className={inputBase}
              placeholder="What keeps them stuck?"
            />
          </div>

          <div>
            <label className={labelBase}>Top 3 desires / goals</label>
            <textarea
              name="audienceDesires"
              rows={3}
              className={inputBase}
              placeholder="What are they secretly hoping to solve?"
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Common objections you hear</label>
            <textarea
              name="objections"
              rows={2}
              className={inputBase}
              placeholder="e.g. 'It's too expensive', 'We tried this before', 'Won't work in my niche'..."
            />
          </div>
        </div>
      </SectionShell>

      {/* 4b. Targeting & Channels */}
      <SectionShell
        step={4}
        eyebrow="Targeting & Channels"
        title="Set the rails for who sees this and where we deploy it"
      >
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelBase}>Target age range</label>
            <div className="mt-1 flex items-center gap-2">
              <input
                name="targetAgeMin"
                type="number"
                min="13"
                max="99"
                className={inputBase}
                placeholder="Min"
              />
              <span className="text-xs text-rl_muted">to</span>
              <input
                name="targetAgeMax"
                type="number"
                min="13"
                max="99"
                className={inputBase}
                placeholder="Max"
              />
            </div>
            <p className="mt-1 text-[11px] text-rl_muted/70">
              We&apos;ll keep optimisation inside this band unless performance suggests widening.
            </p>
          </div>

          <div>
            <label className={labelBase}>Targeting style</label>
            <select
              name="targetingStyle"
              className={inputBase}
              defaultValue=""
            >
              <option value="" disabled>
                Choose the dominant approach
              </option>
              <option value="demographic">Demographic (age, gender, income)</option>
              <option value="geographic">Geographic (countries, regions, radius)</option>
              <option value="behavioral">Behavioral (site actions, history)</option>
              <option value="interest">Interest / psychographic</option>
              <option value="contextual">Contextual (page / content based)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Key locations to prioritise</label>
            <input
              name="targetLocations"
              className={inputBase}
              placeholder="e.g. US & Canada, UK + EU, DACH, 20km radius around Austin..."
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Interests & intent signals to lean on</label>
            <textarea
              name="targetInterests"
              rows={2}
              className={inputBase}
              placeholder="Hobbies, behaviours, keywords – whatever best describes the people this is for."
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>Platforms we&apos;re using for this campaign</label>
            <input
              name="platforms"
              className={inputBase}
              placeholder="e.g. Meta Ads, TikTok, YouTube, Google Search, Email / CRM"
            />
            <p className="mt-1 text-[11px] text-rl_muted/70">
              Comma-separated. We&apos;ll mirror this list onto your dashboard &amp; settings.
            </p>
          </div>
        </div>
      </SectionShell>

      {/* 5. Creative Direction & Brand Voice */}
      <SectionShell
        step={5}
        eyebrow="Creative Direction"
        title="How should this campaign feel?"
      >
        <p className="text-xs text-rl_muted">
          We&apos;ll use this to lock tone, pacing, and visual direction so the
          AI doesn&apos;t go off-brand.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelBase}>
              Brand voice in 3–5 adjectives
            </label>
            <input
              name="brandVoice"
              className={inputBase}
              placeholder="e.g. Calm, precise, direct, premium, playful"
            />
          </div>

          <div>
            <label className={labelBase}>
              Things we must NOT say or do
            </label>
            <input
              name="doNotSay"
              className={inputBase}
              placeholder="Words, claims, tones to avoid."
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>
              Links to ads / pages you love (any brand)
            </label>
            <textarea
              name="inspirationLinks"
              rows={2}
              className={inputBase}
              placeholder="Paste URLs and tell us what you like about them."
            />
          </div>

          <div>
            <label className={labelBase}>
              Visual guidelines (colors, fonts, do&apos;s & don&apos;ts)
            </label>
            <textarea
              name="visualGuidelines"
              rows={2}
              className={inputBase}
              placeholder="You can also link a brand deck or Figma file."
            />
          </div>

          {isSingleVideo && (
            <div className="md:col-span-2">
              <label className={labelBase}>
                Single video: hook and angle ideas you already have
              </label>
              <textarea
                name="singleVideoIdeas"
                rows={3}
                className={inputBase}
                placeholder="If you have phrases, hooks, or scenes in mind, drop them here."
              />
            </div>
          )}
        </div>
      </SectionShell>

      {/* 6. Channels, Tools & Data */}
      <SectionShell
        step={6}
        eyebrow="Stack & Data"
        title="Where will this campaign live?"
      >
        <p className="text-xs text-rl_muted">
          We design campaigns to fit into your current stack instead of
          fighting it.
        </p>

        <div className="mt-3 space-y-4">
          <div>
            <label className={labelBase}>
              Primary ad channels for this campaign
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRIMARY_CHANNEL_OPTIONS.map((ch) => {
                const selected = primaryChannels.includes(ch);
                return (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`${chipBase} ${
                      selected ? chipSelected : chipUnselected
                    }`}
                  >
                    {ch}
                  </button>
                );
              })}
            </div>
            <input
              type="hidden"
              name="primaryChannels"
              value={primaryChannels.join(", ")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className={labelBase}>
                CRM / email / SMS tools in use
              </label>
              <select
                name="crmTools"
                className={inputBase}
                defaultValue=""
              >
                <option value="" disabled>
                  Select the closest match
                </option>
                {CRM_OPTIONS.map((tool) => (
                  <option key={tool} value={tool}>
                    {tool}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelBase}>Analytics setup</label>
              <select
                name="analyticsTools"
                className={inputBase}
                defaultValue=""
              >
                <option value="" disabled>
                  Select what&apos;s true today
                </option>
                {ANALYTICS_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelBase}>
                Links to relevant data / dashboards (if any)
              </label>
              <input
                name="dataLinks"
                className={inputBase}
                placeholder="Read-only links are fine."
              />
            </div>
          </div>

          <div>
            <label className={labelBase}>
              Past campaigns we should study (wins & flops)
            </label>
            <textarea
              name="history"
              rows={3}
              className={inputBase}
              placeholder="Drop links to past ads, funnels, or notes and tell us what worked / didn't."
            />
          </div>
        </div>
      </SectionShell>

      {/* 7. Compliance, Constraints & Brand Politics */}
      <SectionShell
        step={7}
        eyebrow="Guardrails"
        title="Compliance, constraints & brand politics"
      >
        <p className="text-xs text-rl_muted">
          Every brand has invisible lines. We design inside them on purpose.
        </p>

        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <label className={labelBase}>Regulated industry?</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["No", "Yes – health", "Yes – finance", "Yes – legal", "Yes – other"].map(
                (option) => {
                  const selected = regulated === option;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setRegulated(option)}
                      className={`${chipBase} ${
                        selected ? chipSelected : chipUnselected
                      }`}
                    >
                      {option}
                    </button>
                  );
                }
              )}
            </div>
            <input
              type="hidden"
              name="regulatedIndustry"
              value={regulated}
            />
          </div>

          <div>
            <label className={labelBase}>Legal / compliance guardrails</label>
            <input
              name="legalConstraints"
              className={inputBase}
              placeholder="Claims, disclosures, approval steps..."
            />
          </div>

          <div className="md:col-span-2">
            <label className={labelBase}>
              Internal politics we should know about
            </label>
            <textarea
              name="internalPolitics"
              rows={3}
              className={inputBase}
              placeholder="Decision makers, veto power, sensitive topics, competing priorities."
            />
          </div>
        </div>
      </SectionShell>

      {/* 8. Presidential-Grade Strategy Layer */}
      {isPresidential && (
        <SectionShell
          step={8}
          eyebrow="Strategy Layer"
          title="Long-range blueprint (Presidential tier)"
        >
          <p className="text-xs text-rl_muted">
            For presidential campaigns, we zoom out: narrative, quarters,
            and power moves your board actually cares about.
          </p>

          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={labelBase}>
                12–18 month vision for this brand
              </label>
              <textarea
                name="longTermVision"
                rows={3}
                className={inputBase}
                placeholder="Where do you want to be positioned in the market a year from now?"
              />
            </div>

            <div>
              <label className={labelBase}>
                Key strategic initiatives this campaign supports
              </label>
              <textarea
                name="strategicInitiatives"
                rows={3}
                className={inputBase}
                placeholder="Product launches, markets, partnerships, fundraising, etc."
              />
            </div>

            <div>
              <label className={labelBase}>
                Stakeholders to impress (by name or role)
              </label>
              <textarea
                name="stakeholders"
                rows={3}
                className={inputBase}
                placeholder="Board, investors, co-founders, key customers..."
              />
            </div>

            <div className="md:col-span-2">
              <label className={labelBase}>
                Anything else we should treat as &quot;presidential only&quot;
              </label>
              <textarea
                name="presidentialNotes"
                rows={3}
                className={inputBase}
                placeholder="Secret weapons, off-limits topics, make-or-break constraints."
              />
            </div>
          </div>
        </SectionShell>
      )}

      {/* Submit */}
      <div className="flex flex-col gap-4 border-t border-rl_border pt-4 md:flex-row md:items-center md:justify-between">
        <p className="max-w-md text-xs text-rl_muted">
          Once you submit, ReGeneLuxe turns this into a structured blueprint
          our AI and strategists can work from. You&apos;ll review the plan
          before anything goes live.
        </p>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          className={[
            "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] uppercase transition-all",
            "bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.16)] hover:-translate-y-[1px] active:translate-y-[1px]",
            "disabled:bg-rl_border disabled:text-rl_muted disabled:cursor-not-allowed",
          ].join(" ")}
          whileHover={!isSubmitting ? { scale: 1.02 } : {}}
          whileTap={!isSubmitting ? { scale: 0.98 } : {}}
        >
          {isSubmitting ? "DRAFTING YOUR BLUEPRINT..." : "SUBMIT BLUEPRINT"}
        </motion.button>
      </div>
    </form>
  );
}
