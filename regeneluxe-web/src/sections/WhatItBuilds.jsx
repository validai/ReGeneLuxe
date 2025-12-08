import FadeSection from "../components/FadeSection";

export default function WhatItBuilds() {
  return (
    <FadeSection>
      <section className="mt-section border-t border-rl_border pt-section">
        <p className="text-xs font-medium uppercase tracking-[0.26em] text-rl_muted">
          What it builds for you
        </p>

        <div className="mt-4 grid gap-8 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-2xl font-medium tracking-[-0.04em] md:text-3xl">
              A full stack of campaign assets, tailored to your brand.
            </h2>
            <p className="text-sm text-rl_muted">
              ReGeneLuxe is not another template bundle. It is a system that
              maps your brand voice and offer into a reusable campaign
              blueprint you can refresh on demand.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft ring-1 ring-rl_border">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                Video system
              </p>
              <p className="mt-2 text-sm">
                Hooks, scenes, and scripts for vertical and widescreen ads.
              </p>
            </div>

            <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft ring-1 ring-rl_border">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                Copy library
              </p>
              <p className="mt-2 text-sm">
                Headlines, body, CTAs, and retargeting angles for all major
                platforms.
              </p>
            </div>

            <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft ring-1 ring-rl_border">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                Automation map
              </p>
              <p className="mt-2 text-sm">
                Sequenced flows for email, SMS, or DMs with clear triggers and
                fallbacks.
              </p>
            </div>

            <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft ring-1 ring-rl_border">
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                Optimization prompts
              </p>
              <p className="mt-2 text-sm">
                Ready-made prompt sets to plug into your AI tools for rapid
                iteration.
              </p>
            </div>
          </div>
        </div>
      </section>
    </FadeSection>
  );
}
