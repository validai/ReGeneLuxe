import FadeSection from "../components/FadeSection";

export default function HowItWorks() {
  return (
    <FadeSection>
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
    </FadeSection>
  );
}
