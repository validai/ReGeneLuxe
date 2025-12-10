import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";
import SiteHeader from "../components/SiteHeader";
import FadeSection from "../components/FadeSection";
import { scaleCardVariant } from "../utils/motionConfig";

export default function Dashboard() {
  const navigate = useNavigate();
  // Route guards in App.jsx handle all redirects

  const user = Auth.user();

  // For now, we show an empty state since there's no campaign storage system yet
  // This will be replaced when campaign persistence is implemented
  const campaigns = [];

  const handleNewCampaign = () => {
    Analytics.event("dashboard_new_campaign_click");
    navigate("/campaign/new");
  };

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <FadeSection>
          <div className="mb-8">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-rl_muted">
              Campaigns
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
              Your ReGeneLuxe Dashboard
            </h1>
            {user && (
              <p className="mt-2 text-sm text-rl_muted">
                Welcome back, {user}
              </p>
            )}
          </div>
        </FadeSection>

        <FadeSection>
          {campaigns.length === 0 ? (
            <motion.div
              className="rounded-2xl border border-rl_border bg-rl_surface px-6 py-10 shadow-rl_soft"
              variants={scaleCardVariant}
              initial="rest"
              whileHover="hover"
            >
              <div className="text-center max-w-md mx-auto">
                <p className="text-sm text-rl_muted mb-4">
                  No campaigns yet. Start your first campaign to generate a complete blueprint.
                </p>
                <motion.button
                  type="button"
                  onClick={handleNewCampaign}
                  className="rounded-full bg-rl_accent px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-[1px] active:translate-y-[1px]"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  START NEW CAMPAIGN
                </motion.button>
              </div>
            </motion.div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {campaigns.map((campaign, index) => (
                <motion.article
                  key={campaign.id}
                  className="rounded-2xl border border-rl_border bg-rl_surface px-6 py-5 shadow-rl_soft hover:border-rl_accent transition cursor-pointer"
                  onClick={() => navigate(`/drafting-room?id=${campaign.id}`)}
                  variants={scaleCardVariant}
                  initial="rest"
                  whileHover="hover"
                  transition={{ delay: index * 0.05 }}
                >
                  <h3 className="text-lg font-semibold text-rl_text mb-1">
                    {campaign.name}
                  </h3>
                  <p className="text-sm text-rl_muted mb-3">
                    {campaign.tierLabel} • Last updated {campaign.lastUpdatedLabel}
                  </p>
                  <motion.button
                    type="button"
                    className="text-sm font-medium text-rl_accent relative"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/drafting-room?id=${campaign.id}`);
                    }}
                    whileHover={{ x: 4 }}
                  >
                    Resume Blueprint →
                    <motion.span
                      className="absolute bottom-0 left-0 h-[1px] bg-rl_accent"
                      initial={{ width: 0 }}
                      whileHover={{ width: "100%" }}
                      transition={{ duration: 0.3 }}
                    />
                  </motion.button>
                </motion.article>
              ))}
            </div>
          )}
        </FadeSection>
      </main>
    </div>
  );
}
