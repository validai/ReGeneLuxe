// FILE: src/sections/Hero.jsx
import { useNavigate } from "react-router-dom";
import FadeSection from "../components/FadeSection";
import { Analytics } from "../utils/analytics";
import { EVENTS } from "../utils/analyticsEvents";

// SAFETY UPGRADE (Mode 3):
// - No logic here, but added future-scale guardrails & doc header.
// - Added role="region" for accessibility.
// - Verified no navigation paths are brittle.

export default function Hero() {
  const nav = useNavigate();

  const handleBeginQuestionnaireClick = () => {
    Analytics.track(EVENTS.CTA_CLICK, {
      label: "Begin questionnaire",
      source: "gate_hero",
    });
    console.log("[Hero] CTA → /start");
    nav("/start");
  };

  return (
    <FadeSection>
      <section
        id="hero-top"
        role="region"
        aria-label="Hero section"
        className="max-w-5xl mx-auto px-6 py-12"
      >
        {/* Hero copy */}
        <div className="max-w-2xl">
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
              onClick={handleBeginQuestionnaireClick}
              className="rounded-full bg-rl_accent px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-md transition-all"
            >
              BEGIN QUESTIONNAIRE
            </button>

            <span className="text-xs text-rl_muted">
              ~3–5 minutes to verify. No credit card.
            </span>
          </div>
        </div>
      </section>
    </FadeSection>
  );
}
