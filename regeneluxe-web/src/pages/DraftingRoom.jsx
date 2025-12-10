// src/pages/DraftingRoom.jsx
import { useMemo, useEffect } from "react";
import { useLocation, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import SiteHeader from "../components/SiteHeader";
import FadeSection from "../components/FadeSection";
import { CAMPAIGN_TIERS } from "../constants/campaignTiers";
import BluePrintForm from "../components/BluePrintForm";
import { fadeUpVariant, baseTransition } from "../utils/motionConfig";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export default function DraftingRoom() {
  const query = useQuery();
  const navigate = useNavigate();
  const tierId = query.get("tier") || "regular";
  // Route guards in App.jsx handle all redirects

  const tier =
    CAMPAIGN_TIERS.find(t => t.id === tierId) ?? CAMPAIGN_TIERS.find(t => t.id === "regular");

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const slideInVariant = {
    hidden: { opacity: 0, x: 24 },
    visible: {
      opacity: 1,
      x: 0,
      transition: baseTransition,
    },
  };

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <FadeSection>
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-rl_muted">
                ReGeneLuxe Drafting Room
              </p>
              <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
                Blueprint your{" "}
                <span className="text-rl_accent">{tier.label}</span> campaign
              </h1>
              <p className="mt-2 max-w-xl text-sm text-rl_muted">
                This is where we turn your context into a precise, AI-ready
                campaign blueprint. The more honest and detailed you are, the more
                "presidential" your outcomes.
              </p>
            </div>

            <motion.div
              whileHover={{ x: -4 }}
              transition={{ duration: 0.2 }}
            >
              <Link
                to="/campaign/new"
                className="text-xs text-rl_muted underline underline-offset-4 hover:text-rl_text transition-colors"
              >
                ← Change campaign tier
              </Link>
            </motion.div>
          </header>
        </FadeSection>

        <motion.div
          className="mx-auto max-w-6xl px-6 py-12 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10"
          variants={prefersReducedMotion ? {} : slideInVariant}
          initial="hidden"
          animate="visible"
        >
          {/* Form Panel */}
          <div className="rounded-2xl border border-rl_border bg-rl_surface px-4 py-5 shadow-rl_soft/70">
            <BluePrintForm tier={tier} />
          </div>

          {/* Tier Summary Panel */}
          <div className="relative">
            <div className="sticky top-24">
              <aside className="rounded-2xl border border-rl_border bg-[#E7DED3] px-6 py-6 shadow-sm space-y-4 w-full">
                <div>
                  <h2 className="text-base font-semibold text-rl_text">Campaign Package</h2>
                  <p className="mt-1 text-xs text-rl_muted">
                    {tier.label} •{" "}
                    <span className="font-semibold text-rl_accent">
                      {tier.priceLabel}
                    </span>
                  </p>
                  <p className="mt-2 text-xs text-rl_muted">{tier.description}</p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-rl_muted">
                    What this unlocks
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-rl_text">
                    {tier.highlightPoints.map(point => (
                      <li key={point} className="flex gap-2">
                        <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-rl_accent" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl bg-rl_surface p-3 text-[11px] text-rl_muted">
                  <p className="font-medium text-rl_accent">
                    Tip for better AI output
                  </p>
                  <p className="mt-1">
                    Use real numbers, real screenshots, and real examples. The
                    blueprint works best when we see what actually happened, not
                    what "should" have happened.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}