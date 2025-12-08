// FILE: src/sections/Hero.jsx
import { useNavigate } from "react-router-dom";
import FadeSection from "../components/FadeSection";

export default function Hero() {
  const nav = useNavigate();

  return (
    <FadeSection>
      <section
        id="hero-top"
        className="grid gap-12 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-center md:pt-6"
      >
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
              onClick={() => {
                console.log("[Hero] CTA → /start");
                nav("/start");
              }}
              className="rounded-full bg-black px-6 py-3 text-xs font-medium uppercase tracking-[0.18em] text-white transition hover:bg-zinc-900"
            >
              begin questionnaire
            </button>

            <span className="text-xs text-rl_muted">
              ~3–5 minutes to verify. No credit card.
            </span>
          </div>
        </div>

        {/* Preview card */}
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
                <span>Automation &amp; follow-up</span>
                <span className="text-[0.65rem] text-rl_muted">
                  Email + DM flows
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </FadeSection>
  );
}
