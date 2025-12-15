// FILE: src/pages/HomePage.jsx
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useScroll, useTransform } from "framer-motion";
import Showcase from "../components/Showcase";
import BrandTitle from "../components/BrandTitle";
import FadeSection from "../components/FadeSection";
import SocialProofStrip from "../sections/home/SocialProofStrip";
import HowItWorks from "../sections/HowItWorks";
import FitCheckPanel from "../sections/home/FitCheckPanel";
import FounderNote from "../sections/home/FounderNote";
import { scaleCardVariant, baseTransition } from "../utils/motionConfig";
import { Auth } from "../utils/auth";
import { Analytics } from "../utils/analytics";
import { Onboarding } from "../utils/onboarding";
import heroBackground from "../assets/HomePage/Background image for homepage regeneluxe_clean.jpeg";

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
    <>
        {/* Hero Section with Background Image */}
        <motion.section
          className="relative w-full min-h-screen flex items-center justify-center overflow-hidden"
          variants={prefersReducedMotion ? undefined : heroContainerVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          animate={prefersReducedMotion ? undefined : "visible"}
        >
          {/* Background Image */}
          <div
            className="absolute inset-0 w-full h-full"
            style={prefersReducedMotion ? {} : { y: heroY }}
          >
            <img
              src={heroBackground}
              alt="ReGeneLuxe luxury background"
              className="w-full h-full object-cover object-center"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-b from-rl_bg/60 via-rl_bg/40 to-rl_bg/80" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 w-full">
            <div className="max-w-2xl space-y-6">
              <motion.div variants={prefersReducedMotion ? undefined : heroItemVariants}>
                <BrandTitle variant="hero" />
              </motion.div>

              <motion.h2
                variants={prefersReducedMotion ? undefined : heroItemVariants}
                className="text-lg sm:text-xl md:text-2xl font-light text-rl_text"
              >
                The most powerful selling engine for creators, brands, and entrepreneurs.
              </motion.h2>

              <motion.p
                variants={prefersReducedMotion ? undefined : heroItemVariants}
                className="text-sm md:text-[0.95rem] text-rl_text/90 max-w-xl"
              >
                ReGeneLuxe transforms your idea into a high-converting, multi-format campaign — automatically. You bring the product. We create the engine that sells it.
              </motion.p>

              <motion.div
                variants={prefersReducedMotion ? undefined : heroItemVariants}
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
                  className="inline-flex items-center justify-center rounded-full border border-rl_text/30 bg-rl_surface/80 backdrop-blur px-5 py-2 text-xs font-medium tracking-[0.2em] text-rl_text hover:bg-rl_surface transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  SIGN IN
                </motion.button>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Social Proof Strip */}
        <SocialProofStrip />

        {/* Content Section */}
        <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-12">
          {/* Carousel */}
          <FadeSection>
            <Showcase className="mt-16" />
          </FadeSection>
        </div>

        {/* How It Works */}
        <HowItWorks />

        {/* Fit Check Panel */}
        <FitCheckPanel />

        {/* Founder Note */}
        <FounderNote />
    </>
  );
}
