import "./index.css";

function App() {
  const scrollToForm = () => {
    const el = document.getElementById("get-started");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-screen bg-rl_bg text-rl_ink">
      {/* Top bar / nav */}
      <header className="sticky top-0 z-20 border-b border-rl_border bg-rl_bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-container items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-black to-gray-500" />
            <span className="text-xs font-medium tracking-[0.24em] uppercase">
              ReGeneLuxe
            </span>
          </div>

          <button
            onClick={scrollToForm}
            className="rounded-full border border-rl_border bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-900"
          >
            Get started
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-container px-6 pb-16 pt-12">
        {/* HERO */}
        <section className="grid gap-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:pt-6">
          {/* Hero copy */}
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.26em] text-rl_muted">
              AI-powered campaign generator
            </p>

            <h1 className="mt-4 text-4xl font-medium tracking-[-0.05em] md:text-5xl">
              Clean, minimal, future-forward
              <span className="block text-2xl font-normal tracking-normal text-rl_muted md:text-3xl">
                campaigns built for you while you sleep.
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-sm leading-relaxed text-rl_muted">
              ReGeneLuxe turns a simple questionnaire into a full, multi-format
              campaign: video concepts, scripts, ad copy, email flows, and
              automation logic — all tuned to your brand, audience, and
              platforms.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={scrollToForm}
                className="rounded-full bg-black px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-900"
              >
                Get started
              </button>

              <span className="text-xs text-rl_muted">
                ~8 minutes to complete the blueprint.  
                <span className="hidden sm:inline">No credit card needed.</span>
              </span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="hidden md:block">
            <div className="rounded-3xl bg-white/80 p-5 shadow-rl_soft ring-1 ring-rl_border">
              <p className="text-[0.65rem] font-medium uppercase tracking-[0.22em] text-rl_muted">
                Preview
              </p>
              <h2 className="mt-3 text-lg font-medium tracking-[-0.02em]">
                Your next campaign, assembled.
              </h2>

              <div className="mt-5 space-y-3 text-xs">
                <div className="flex items-center justify-between rounded-xl bg-rl_accentSoft/70 px-4 py-3">
                  <span>Vertical video sequence</span>
                  <span className="rounded-full bg-black px-2.5 py-1 text-[0.6rem] font-medium text-white">
                    5 scenes
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-rl_accentSoft/50 px-4 py-3">
                  <span>Ad copy bundle</span>
                  <span className="text-[0.65rem] text-rl_muted">
                    Meta, TikTok, YouTube
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-rl_accentSoft/40 px-4 py-3">
                  <span>Automation & follow-up</span>
                  <span className="text-[0.65rem] text-rl_muted">
                    Email + DM flows
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="mt-section border-t border-rl_border pt-section">
          <p className="text-xs font-medium uppercase tracking-[0.26em] text-rl_muted">
            How ReGeneLuxe works
          </p>

          <h2 className="mt-4 text-2xl font-medium tracking-[-0.04em] md:text-3xl">
            One form in. A complete campaign out.
          </h2>

          <div className="mt-8 grid gap-8 md:grid-cols-3">
            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                01 — Capture your signal
              </p>
              <p className="mt-3 text-sm text-rl_muted">
                You answer a guided questionnaire about your offer, audience,
                tone, and platforms. No jargon — just the language you already
                use with clients.
              </p>
            </div>

            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                02 — Generate & assemble
              </p>
              <p className="mt-3 text-sm text-rl_muted">
                Our AI stack turns that into scripts, hooks, angles, email
                flows, social posts, and automation rules that all reference the
                same core narrative.
              </p>
            </div>

            <div>
              <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                03 — Optimize in the loop
              </p>
              <p className="mt-3 text-sm text-rl_muted">
                As you run campaigns, ReGeneLuxe learns from performance and
                suggests new variants — keeping the strategy consistent while
                the creative evolves.
              </p>
            </div>
          </div>
        </section>

        {/* WHAT IT BUILDS */}
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
              <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft/50 ring-1 ring-rl_border">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                  Video system
                </p>
                <p className="mt-2 text-sm">
                  Hooks, scenes, and scripts for vertical and widescreen ads.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft/50 ring-1 ring-rl_border">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                  Copy library
                </p>
                <p className="mt-2 text-sm">
                  Headlines, body, CTAs, and retargeting angles for all major
                  platforms.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft/50 ring-1 ring-rl_border">
                <p className="text-[0.68rem] font-medium uppercase tracking-[0.24em] text-rl_muted">
                  Automation map
                </p>
                <p className="mt-2 text-sm">
                  Sequenced flows for email, SMS, or DMs with clear triggers and
                  fallbacks.
                </p>
              </div>

              <div className="rounded-2xl bg-white/80 p-4 text-sm shadow-rl_soft/50 ring-1 ring-rl_border">
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

        {/* GET STARTED FORM */}
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
                Tell us who you are.  
                <span className="block text-rl_muted">
                  We’ll tailor the questions around your world.
                </span>
              </h2>
              <p className="mt-4 text-sm text-rl_muted">
                This is the doorway into the ReGeneLuxe system. You’ll answer a
                short series of prompts about your offer, channels, and goals.
                From there, we generate a first-pass campaign you can refine
                with your own AI stack — or with ours.
              </p>
            </div>

            <div className="rounded-3xl bg-white/90 p-6 shadow-rl_soft ring-1 ring-rl_border">
              <form
                className="space-y-4 text-sm"
                onSubmit={(e) => e.preventDefault()}
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
                  className="mt-2 w-full rounded-full bg-black py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-900"
                >
                  Begin questionnaire
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

        {/* FOOTER */}
        <footer className="mt-section border-t border-rl_border pt-8 text-xs text-rl_muted">
          <div className="flex flex-col items-start justify-between gap-4 pb-10 sm:flex-row sm:items-center">
            <span>© {new Date().getFullYear()} ReGeneLuxe.</span>
            <span className="text-[0.68rem]">
              Built for creators, small teams, and brands who want enterprise-grade
              systems without enterprise-grade chaos.
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default App;
