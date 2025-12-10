// src/components/BluePrintForm.jsx
import { useState } from "react";
import { motion } from "framer-motion";
import { Analytics } from "../utils/analytics";

export default function BluePrintForm({ tier }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = e => {
    e.preventDefault();
    setIsSubmitting(true);
    Analytics.event("blueprint_submit_attempt", { tier: tier?.id });

    // TODO: Replace with real API call later
    setTimeout(() => {
      setIsSubmitting(false);
      Analytics.event("blueprint_submit_success", { tier: tier?.id });
      alert("Blueprint submitted. ReGeneLuxe will now draft your campaign.");
    }, 900);
  };

  const isPresidential = tier?.id === "presidential";
  const isSingleVideo = tier?.id === "single-video";

  return (
    <form onSubmit={handleSubmit} className="space-y-8 text-sm">
      {/* 1. Brand & Point of Contact */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          1. Brand & Point of Contact
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          Who are we building this for, and who signs off on the work?
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-rl_muted">
              Your full name
            </label>
            <input
              name="contactName"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Jane Doe"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Role / title
            </label>
            <input
              name="role"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Founder, CMO, Solo creator..."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Brand / company name
            </label>
            <input
              name="brandName"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="ReGeneLuxe Labs"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Best contact email
            </label>
            <input
              name="email"
              type="email"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="you@brand.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Website / main landing page
            </label>
            <input
              name="website"
              type="url"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="https://yourbrand.com"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Time zone
            </label>
            <input
              name="timezone"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. EST, PST, CET"
            />
          </div>
        </div>
      </section>

      {/* 2. Campaign Scope & Objectives */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          2. Campaign Scope & Objectives
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          Tell us what "a win" looks like for this campaign.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-rl_muted">
              Working campaign name
            </label>
            <input
              name="campaignName"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Q1 Launch – Founders Edition"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Primary objective
            </label>
            <select
              name="primaryObjective"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
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
            <label className="block text-xs text-rl_muted">
              Success metric (one number)
            </label>
            <input
              name="successMetric"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. 300 sales in 30 days at $X CPA"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Ideal timeline
            </label>
            <input
              name="timeline"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. Start Jan 15, run for 90 days"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Monthly media budget (USD)
            </label>
            <input
              name="mediaBudget"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. 5,000 – 15,000"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Markets / regions to target
            </label>
            <input
              name="regions"
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. US only, US + UK, DACH..."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-rl_muted">
            If this campaign fails, what will have gone wrong?
          </label>
          <textarea
            name="failureModes"
            rows={3}
            className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            placeholder="Be honest – this helps us design around real risks."
          />
        </div>
      </section>

      {/* 3. Offer & Product */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          3. Offer & Product
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          Explain what you&apos;re selling like we&apos;re your smartest customer.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-xs text-rl_muted">
              What are you promoting in this campaign?
            </label>
            <textarea
              name="offer"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Product, service, bundle, event, subscription..."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Key outcome / promise
            </label>
            <input
              name="keyOutcome"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. 'Double your qualified demos in 60 days'"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Main price point and structure
            </label>
            <input
              name="pricePoint"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. $97/mo, $2,000 once, tiered pricing..."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Guarantees or risk reversals
            </label>
            <input
              name="guarantees"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="If any."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Upsells / cross-sells tied to this offer
            </label>
            <input
              name="upsells"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="We'll use this to design LTV-aware flows."
            />
          </div>
        </div>
      </section>

      {/* 4. Target Audience & Psychology */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          4. Target Audience & Psychology
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          The better we understand their headspace, the sharper the message.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-xs text-rl_muted">
              Who is the primary audience?
            </label>
            <textarea
              name="audience"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Demographics, roles, industries, or creator niches."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Top 3 pains / frustrations
            </label>
            <textarea
              name="audiencePains"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="What keeps them stuck?"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Top 3 desires / goals
            </label>
            <textarea
              name="audienceDesires"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="What are they secretly hoping to solve?"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-rl_muted">
              Common objections you hear
            </label>
            <textarea
              name="objections"
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. 'It's too expensive', 'We tried this before', 'Won't work in my niche'..."
            />
          </div>
        </div>
      </section>

      {/* 5. Creative Direction & Brand Voice */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          5. Creative Direction & Brand Voice
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          Give us rails so the AI sounds like you, not a template.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-rl_muted">
              Brand voice in 3–5 adjectives
            </label>
            <input
              name="brandVoice"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. Calm, precise, direct, premium, playful"
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Things we must NOT say or do
            </label>
            <input
              name="doNotSay"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Words, claims, tones to avoid."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-rl_muted">
              Links to ads / pages you love (any brand)
            </label>
            <textarea
              name="inspirationLinks"
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Paste URLs and tell us what you like about them."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Visual guidelines (colors, fonts, do&apos;s & don&apos;ts)
            </label>
            <textarea
              name="visualGuidelines"
              rows={2}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="You can also link a brand deck or Figma file."
            />
          </div>

          {isSingleVideo && (
            <div>
              <label className="block text-xs text-rl_muted">
                Single Video: hook and angle ideas you already have
              </label>
              <textarea
                name="singleVideoIdeas"
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                placeholder="If you have phrases, hooks, or scenes in mind, drop them here."
              />
            </div>
          )}
        </div>
      </section>

      {/* 6. Channels, Tools & Data */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          6. Channels, Tools & Data
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          This helps ReGeneLuxe plug into your stack instead of fighting it.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-rl_muted">
              Primary ad channels for this campaign
            </label>
            <input
              name="primaryChannels"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. Meta, TikTok, YouTube, Google Search, email..."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              CRM / email / SMS tools in use
            </label>
            <input
              name="crmTools"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. HubSpot, Klaviyo, Mailchimp, Attentive..."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Analytics setup
            </label>
            <input
              name="analyticsTools"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="GA4, server events, pixel only, etc."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Links to relevant data / dashboards (if any)
            </label>
            <input
              name="dataLinks"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Read-only links are fine."
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-xs text-rl_muted">
            Past campaigns we should study (wins & flops)
          </label>
          <textarea
            name="history"
            rows={3}
            className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            placeholder="Drop links to past ads, funnels, or notes and tell us what worked / didn't."
          />
        </div>
      </section>

      {/* 7. Compliance, Constraints & Brand Politics */}
      <section>
        <h2 className="text-base font-semibold text-rl_text">
          7. Compliance, Constraints & Brand Politics
        </h2>
        <p className="mt-1 text-xs text-rl_muted">
          Every brand has invisible lines. We design inside them on purpose.
        </p>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-xs text-rl_muted">
              Regulated industry?
            </label>
            <input
              name="regulatedIndustry"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="e.g. Yes – health/finance/legal. Or 'No'."
            />
          </div>

          <div>
            <label className="block text-xs text-rl_muted">
              Legal / compliance guardrails
            </label>
            <input
              name="legalConstraints"
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Claims, disclosures, approval steps..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs text-rl_muted">
              Internal politics we should know about
            </label>
            <textarea
              name="internalPolitics"
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
              placeholder="Decision makers, veto power, sensitive topics, competing priorities."
            />
          </div>
        </div>
      </section>

      {/* 8. Presidential-Grade Strategy Layer */}
      {isPresidential && (
        <section>
          <h2 className="text-base font-semibold text-rl_text">
            8. Presidential-Grade Strategy Layer
          </h2>
          <p className="mt-1 text-xs text-rl_muted">
            For presidential campaigns, we zoom out: narrative, quarters, and power moves.
          </p>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="block text-xs text-rl_muted">
                12–18 month vision for this brand
              </label>
              <textarea
                name="longTermVision"
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                placeholder="Where do you want to be positioned in the market a year from now?"
              />
            </div>

            <div>
              <label className="block text-xs text-rl_muted">
                Key strategic initiatives this campaign supports
              </label>
              <textarea
                name="strategicInitiatives"
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                placeholder="Product launches, markets, partnerships, fundraising, etc."
              />
            </div>

            <div>
              <label className="block text-xs text-rl_muted">
                Stakeholders to impress (by name or role)
              </label>
              <textarea
                name="stakeholders"
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                placeholder="Board, investors, co-founders, key customers..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs text-rl_muted">
                Anything else we should treat as "presidential only"
              </label>
              <textarea
                name="presidentialNotes"
                rows={3}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm
                         border-rl_border bg-rl_surface text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
                placeholder="Secret weapons, off-limits topics, make-or-break constraints."
              />
            </div>
          </div>
        </section>
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-3 border-t border-rl_border pt-4">
        <p className="max-w-md text-xs text-rl_muted">
          Once you submit, ReGeneLuxe will turn this into a structured blueprint
          our AI and strategists can work from. You&apos;ll review before anything
          goes live.
        </p>

        <motion.button
          type="submit"
          disabled={isSubmitting}
          className={[
            "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-sm font-semibold tracking-[0.18em] transition-all",
            "rounded-full bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.12)] hover:-translate-y-[1px] active:translate-y-[1px]",
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