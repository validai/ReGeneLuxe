// FILE: src/pages/HomePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Showcase from "../components/Showcase";
import SiteHeader from "../components/SiteHeader";
import BrandTitle from "../components/BrandTitle";
import FadeSection from "../components/FadeSection";
import { scaleCardVariant, baseTransition } from "../utils/motionConfig";
import { Auth } from "../utils/auth";
import { Analytics } from "../utils/analytics";
import { Onboarding } from "../utils/onboarding";

export default function HomePage() {
  const nav = useNavigate();

  // Route guards in App.jsx handle all redirects

  const authed = Auth.isSignedIn();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 500], [0, -40]);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const heroContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.1,
      },
    },
  };

  const heroItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: baseTransition,
    },
  };

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-12">
        <motion.section
          className="grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-center"
          variants={prefersReducedMotion ? {} : heroContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="space-y-6">
            <motion.div variants={prefersReducedMotion ? {} : heroItemVariants}>
              <BrandTitle variant="hero" />
            </motion.div>

            <motion.h2
              variants={prefersReducedMotion ? {} : heroItemVariants}
              className="text-lg sm:text-xl md:text-2xl font-light text-rl_muted"
            >
              Hyper-personalised campaign drafting, packaged like a luxury
              service instead of a chaotic ad account.
            </motion.h2>

            <motion.p
              variants={prefersReducedMotion ? {} : heroItemVariants}
              className="text-sm md:text-[0.95rem] text-rl_muted max-w-xl"
            >
              ReGeneLuxe turns your context into a structured campaign
              blueprint that our AI and strategists can execute, test, and
              refine – without you drowning in dashboards.
            </motion.p>

            <motion.div
              variants={prefersReducedMotion ? {} : heroItemVariants}
              className="flex flex-wrap gap-3 pt-2"
            >
              <motion.button
                onClick={() => {
                  Analytics.event("home_tile_click", {
                    tile: "new_here_gate",
                  });
                  nav("/gate");
                }}
                className="rounded-full bg-rl_accent px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-[1px] active:translate-y-[1px]"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                GET STARTED
              </motion.button>
              <motion.button
                onClick={() => {
                  Analytics.event("home_tile_click", {
                    tile: "returning_login",
                  });
                  nav("/login");
                }}
                className="inline-flex items-center justify-center rounded-full border border-rl_border px-5 py-2 text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                SIGN IN
              </motion.button>
            </motion.div>
          </div>

          {/* Right column: future hero imagery placeholder */}
          <motion.div
            className="hidden md:block"
            style={prefersReducedMotion ? {} : { y: heroY }}
            variants={prefersReducedMotion ? {} : heroItemVariants}
          >
            <motion.div
              className="relative overflow-hidden rounded-2xl border border-rl_border bg-rl_surface shadow-rl_soft"
              variants={prefersReducedMotion ? {} : scaleCardVariant}
              initial="rest"
              whileHover="hover"
            >
              {/* Placeholder gradient for future photography */}
              <div className="h-64 bg-gradient-to-br from-rl_surfaceSoft via-rl_bg to-rl_surfaceSoft" />
              <div className="absolute inset-0 flex items-end justify-between p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-rl_muted">
                  Campaign Blueprints
                </p>
                <span className="rounded-full border border-rl_border bg-rl_surfaceSoft px-3 py-1 text-[0.7rem] uppercase tracking-[0.2em] text-rl_text">
                  Preview
                </span>
              </div>
            </motion.div>
          </motion.div>
        </motion.section>

        {/* Carousel */}
        <FadeSection>
          <Showcase className="mt-16" />
        </FadeSection>
      </main>
    </div>
  );
}
