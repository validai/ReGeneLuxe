// src/pages/NewCampaign.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FadeSection from "../components/FadeSection";
import { CAMPAIGN_TIERS } from "../constants/campaignTiers";
import { scaleCardVariant, baseTransition } from "../utils/motionConfig";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";
import { EVENTS } from "../utils/analyticsEvents";

export default function NewCampaign() {
  const navigate = useNavigate();
  const [selectedTierId, setSelectedTierId] = useState(null);
  // Route guards in App.jsx handle all redirects

  useEffect(() => {
    Analytics.track(EVENTS.CAMPAIGN_NEW_VIEW, {});
  }, []);

  const handleGoToDraftingRoom = () => {
    if (!selectedTierId) {
      Analytics.track(EVENTS.CAMPAIGN_CREATION_FAILED, {
        message: "No tier selected",
      });
      return;
    }

    try {
      const selectedTier = CAMPAIGN_TIERS.find(t => t.id === selectedTierId);
      Analytics.track(EVENTS.CAMPAIGN_CREATED, {
        tierId: selectedTierId,
        tierLabel: selectedTier?.label || null,
      });
      navigate(`/drafting-room?tier=${selectedTierId}`);
    } catch (error) {
      Analytics.track(EVENTS.CAMPAIGN_CREATION_FAILED, {
        message: error?.message,
      });
    }
  };

  const selectedTier = CAMPAIGN_TIERS.find(t => t.id === selectedTierId);

  return (
    <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <FadeSection>
          <header>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-rl_muted">
              New Campaign
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
              Choose your ReGeneLuxe tier
            </h1>
            <p className="mt-2 text-sm text-rl_muted max-w-2xl">
              Choose how far you want ReGeneLuxe to take you. From a single
              flagship video to an elite, multi-quarter campaign lab. Built to outperform agencies. Powered by elite AI orchestration.
            </p>
          </header>
        </FadeSection>

        {/* Tier Cards */}
        <FadeSection>
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {CAMPAIGN_TIERS.map((tier, index) => {
            const isSelected = tier.id === selectedTierId;
            return (
              <motion.button
                key={tier.id}
                type="button"
                onClick={() => setSelectedTierId(tier.id)}
                className={[
                  "flex flex-col h-full rounded-2xl border px-4 py-5 text-left transition",
                  "border-rl_border bg-rl_surface shadow-rl_soft/50",
                  isSelected ? "border-[#CBAD8D] shadow-[0_0_0_2px_rgba(203,173,141,0.2)]" : "",
                ].join(" ")}
                variants={scaleCardVariant}
                initial="rest"
                whileHover="hover"
                whileFocus="hover"
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-rl_text">{tier.label}</h2>
                  <span className="rounded-full bg-rl_surfaceSoft px-3 py-1 text-xs uppercase tracking-wide text-rl_text">
                    {tier.priceLabel}
                  </span>
                </div>

                <p className="mt-2 text-sm text-rl_muted">
                  {tier.shortTagline}
                </p>

                <p className="mt-3 text-xs text-rl_muted">
                  {tier.description}
                </p>

                <ul className="mt-4 space-y-1.5 text-xs text-rl_text">
                  {tier.highlightPoints.map((point, pointIndex) => (
                    <motion.li
                      key={point}
                      className="flex gap-2"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...baseTransition, delay: index * 0.05 + pointIndex * 0.03 }}
                    >
                      <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-rl_accent" />
                      <span>{point}</span>
                    </motion.li>
                  ))}
                </ul>

                <p className="mt-4 text-[11px] uppercase tracking-wide text-rl_muted">
                  Ideal for:{" "}
                  <span className="text-rl_text">{tier.idealFor}</span>
                </p>
              </motion.button>
            );
          })}
          </section>
        </FadeSection>

        {/* Footer CTA */}
        <FadeSection>
          <footer className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-rl_muted">
              {selectedTier ? (
                <>
                  <span className="font-medium text-rl_text">
                    {selectedTier.label}
                  </span>{" "}
                  selected – {selectedTier.shortTagline}
                </>
              ) : (
                "Select a tier to unlock your Drafting Room."
              )}
            </div>

            <motion.button
              type="button"
              onClick={handleGoToDraftingRoom}
              disabled={!selectedTierId}
              className={[
                "inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] transition-all",
                "rounded-full bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.12)] hover:-translate-y-[1px] active:translate-y-[1px]",
                "disabled:bg-rl_border disabled:text-rl_muted disabled:cursor-not-allowed"
              ].join(" ")}
              whileHover={!selectedTierId ? {} : { scale: 1.02 }}
              whileTap={!selectedTierId ? {} : { scale: 0.98 }}
            >
              TAKE ME TO THE DRAFTING ROOM
            </motion.button>
          </footer>
        </FadeSection>
    </div>
  );
}