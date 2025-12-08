import React, { useState } from "react";
import FadeSection from "../components/FadeSection";
import { Analytics } from "../utils/analytics";

export default function BlueprintForm() {
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (submitting) {
      Analytics.event("blueprint_submit_ignored_already_submitting");
      return;
    }

    setSubmitting(true);
    Analytics.event("blueprint_submit_attempt");

    // Placeholder: when real submission is wired, move setSubmitting(false)
    // to the async completion path.
    setTimeout(() => {
      setSubmitting(false);
    }, 300);
  };

  return (
    <FadeSection>
      <section
        id="get-started"
        className="mt-section border-t border-rl_border pt-section"
      >
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-rl_muted">
          Start your blueprint
        </p>

        <div className="mt-4 grid gap-10 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:items-start">
          <div>
            <h2 className="text-2xl font-medium tracking-[-0.04em] md:text-3xl">
              Tell us who you are.{" "}
              <span className="block text-rl_muted">
                We'll tailor the questions around your world.
              </span>
            </h2>
            <p className="mt-4 text-sm text-rl_muted">
              This is the doorway into the ReGeneLuxe system. You'll answer a
              short series of prompts about your offer, channels, and goals.
              From there, we generate a first-pass campaign you can refine with
              your own AI stack — or with ours.
            </p>
          </div>

          <div className="rounded-3xl bg-white/90 p-6 shadow-rl_soft ring-1 ring-rl_border">
            <form
              className="space-y-4 text-sm"
              onSubmit={handleSubmit}
            >
              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                  Work email
                </label>
                <input
                  type="email"
                  placeholder="you@brand.com"
                  className="mt-2 w-full rounded-xl border border-rl_border bg-rl_accentSoft/40 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                  Primary focus
                </label>
                <select className="mt-2 w-full rounded-xl border border-rl_border bg-rl_accentSoft/40 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white">
                  <option>Creator / Personal brand</option>
                  <option>E-commerce brand</option>
                  <option>Coaching / education</option>
                  <option>Service business / agency</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                  Main channels today
                </label>
                <input
                  type="text"
                  placeholder="e.g. Instagram, TikTok, YouTube, email"
                  className="mt-2 w-full rounded-xl border border-rl_border bg-rl_accentSoft/40 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`mt-2 w-full rounded-full py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition ${
                  submitting
                    ? "bg-zinc-400 cursor-not-allowed"
                    : "bg-black hover:bg-zinc-900"
                }`}
              >
                {submitting ? "Sending…" : "Begin questionnaire"}
              </button>

              <p className="pt-2 text-[0.68rem] leading-relaxed text-rl_muted">
                This form is a placeholder for now. Soon it will connect
                directly to the ReGeneLuxe onboarding flow and your preferred
                AI tools.
              </p>
            </form>
          </div>
        </div>
      </section>
    </FadeSection>
  );
}
