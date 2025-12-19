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

  const goToQuestionnaire = () => {
    Analytics.event("home_tile_click", {
      tile: "questionnaire_cta",
    });
    nav("/gate");
  };

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
          className="relative min-h-[80vh] flex items-center overflow-hidden"
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
            <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/35 to-black/15" />
          </div>

          {/* Hero Content */}
          <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 w-full">
            <div className="max-w-2xl space-y-6">
              <motion.div variants={prefersReducedMotion ? undefined : heroItemVariants}>
                <h1 className="text-[2.7rem] sm:text-[3.2rem] lg:text-[3.6rem] font-semibold tracking-[0.35em] uppercase text-white mb-4">
                  REGENELUXE
                </h1>
              </motion.div>

              <motion.h2
                variants={prefersReducedMotion ? undefined : heroItemVariants}
                className="max-w-2xl text-lg sm:text-xl text-white/90 mb-4"
              >
                The most powerful selling engine for creators, brands, and entrepreneurs.
              </motion.h2>

              <motion.p
                variants={prefersReducedMotion ? undefined : heroItemVariants}
                className="max-w-xl text-sm sm:text-base text-white/80 mb-8"
              >
                ReGeneLuxe transforms your idea into a high-converting, multi-format campaign — automatically. You bring the product. We create the engine that sells it.
              </motion.p>

              <motion.div
                variants={prefersReducedMotion ? undefined : heroItemVariants}
                className="flex flex-wrap items-center gap-3"
              >
                <motion.button
                  onClick={() => {
                    Analytics.event("home_tile_click", {
                      tile: "new_here_gate",
                    });
                    nav("/gate");
                  }}
                  className="px-5 py-2.5 rounded-full bg-[#c5955a] text-sm font-semibold text-white tracking-wide shadow-md shadow-black/30 hover:bg-[#d2a46a] transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Get started
                </motion.button>
                <motion.button
                  onClick={() => {
                    Analytics.event("home_tile_click", {
                      tile: "returning_login",
                    });
                    nav("/login");
                  }}
                  className="px-5 py-2.5 rounded-full border border-white/70 bg-white/10 text-sm font-medium text-white hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Sign in
                </motion.button>
                <p className="text-xs text-white/80 sm:ml-3 flex flex-wrap items-center gap-2">
                  Start with a 7-minute questionnaire. No payment required.{" "}
                  <button
                    type="button"
                    onClick={goToQuestionnaire}
                    className="underline underline-offset-4 decoration-white/70 hover:decoration-white transition-colors"
                  >
                    Open questionnaire
                  </button>
                </p>
              </motion.div>
            </div>
          </div>
        </motion.section>

        {/* Micro Onboarding Bar */}
        <section className="bg-[#f4eee7] border-y border-[#ebddcd]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs sm:text-sm text-neutral-800 text-center sm:text-left">
              <span className="font-semibold">Not sure where to start?</span>{" "}
              Take the 7-minute Signature Questionnaire and get a custom campaign blueprint.
            </p>
            <button
              type="button"
              onClick={goToQuestionnaire}
              className="inline-flex items-center justify-center rounded-full bg-[#c5955a] px-4 py-1.5 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#d2a46a] transition-colors"
            >
              Start the questionnaire
              <span className="ml-1.5 text-base leading-none">→</span>
            </button>
          </div>
        </section>

        {/* Social Proof Strip */}
        <SocialProofStrip />

        {/* What You Get Section */}
        <WhatYouGetSection goToQuestionnaire={goToQuestionnaire} />

        {/* Content Section */}
        <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-12">
          {/* Carousel */}
          <FadeSection>
            <Showcase className="mt-16" />
          </FadeSection>
          
        </div>

        {/* Mini Demo Tiles */}
        <MiniDemoTiles goToQuestionnaire={goToQuestionnaire} />

        {/* Common Problems We Solve */}
        <CommonProblemsSection goToQuestionnaire={goToQuestionnaire} />

        {/* How It Works */}
        <HowItWorks />

        {/* Fit Check Panel */}
        <FitCheckPanel />

        {/* Founder Note */}
        <FounderNote />

        {/* Pre-footer CTA */}
        <section className="py-10 bg-[#f4eee7] border-t border-[#ebddcd]">
          <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-lg sm:text-xl font-semibold text-neutral-900">
              Ready to turn your campaigns into a system?
            </h2>
            <p className="mt-2 text-sm text-neutral-700">
              The Signature Questionnaire is the first step toward your ReGeneLuxe blueprint.
            </p>
            <button
              type="button"
              onClick={goToQuestionnaire}
              className="mt-4 px-6 py-2.5 rounded-full bg-[#c5955a] text-sm font-semibold text-white tracking-wide shadow-md shadow-black/15 hover:bg-[#d2a46a] transition-colors"
            >
              Start the questionnaire →
            </button>
          </div>
        </section>

    </>
  );
}

// What You Get Section Component
function WhatYouGetSection({ goToQuestionnaire }) {
  const whatYouGet = [
    {
      title: "Campaign spine",
      body: "A single signature campaign blueprint your whole team can follow.",
    },
    {
      title: "Story framework",
      body: "A narrative that ties offers, angles, and channels into one clear story.",
    },
    {
      title: "Channel map",
      body: "Message and asset mapping across paid and owned channels.",
    },
    {
      title: "Launch calendar",
      body: "Quarterly launch roadmap so you're not scrambling week to week.",
    },
    {
      title: "Creative guidelines",
      body: "Design and copy guardrails so every asset feels on-brand.",
    },
    {
      title: "AI-ready structure",
      body: "Blueprints you can feed into AI tools without losing control of the message.",
    },
    {
      title: "Executive-ready deck",
      body: "A clean narrative and visuals leadership can sign off on quickly.",
    },
    {
      title: "Repeatable system",
      body: "A campaign engine you can rerun and iterate on, not a one-off launch.",
    },
  ];

  return (
    <section className="py-16 bg-[#f4eee7]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500">
            What you get
          </p>
          <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-900">
            What you get with ReGeneLuxe
          </h2>
          <p className="mt-2 text-sm text-neutral-700 max-w-2xl mx-auto">
            The Signature Questionnaire doesn't just give you ideas. It produces a concrete campaign system your team can pick up and run.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whatYouGet.map((item) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="rounded-2xl bg-[#faf5ee] border border-[#f0e2d2] px-4 py-4 shadow-[0_12px_30px_rgba(15,10,5,0.12)] hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,10,5,0.16)] transition-transform"
            >
              <p className="text-xs tracking-[0.18em] uppercase text-neutral-500 mb-1">
                {item.title}
              </p>
              <p className="text-sm text-neutral-800 leading-relaxed">
                {item.body}
              </p>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={goToQuestionnaire}
            className="px-6 py-2.5 rounded-full bg-[#c5955a] text-sm font-semibold text-white tracking-wide shadow-md shadow-black/15 hover:bg-[#d2a46a] transition-colors"
          >
            Start the questionnaire to see your version →
          </button>
        </div>
      </div>
    </section>
  );
}

// Pattern Orbit Component
function PatternOrbit() {
  const [isRunning, setIsRunning] = React.useState(false);
  const stageRef = React.useRef(null);
  const [computedRadius, setComputedRadius] = React.useState(210);
  const [cardSize, setCardSize] = React.useState(150);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const PATTERN_ORBIT_ITEMS = [
    {
      id: "campaigns-no-story",
      text: "Campaigns that run, but don't ladder up to a clear story.",
      bgImage: "/Homepage Cards/Campaigns that run Card.png",
    },
    {
      id: "launches-slack",
      text: "Launches planned in Slack threads and screenshots instead of one source of truth.",
      bgImage: "/Homepage Cards/Launches planned in Slack Card.png",
    },
    {
      id: "winning-ads-no-spine",
      text: "Winning ads that can't be scaled because there's no campaign spine.",
      bgImage: "/Homepage Cards/Winning ads Card.png",
    },
    {
      id: "teams-no-guardrails",
      text: "Teams building assets without shared messaging or guardrails.",
      bgImage: "/Homepage Cards/Teams building assets Card.png",
    },
    {
      id: "leadership-clarity",
      text: "Leadership asking for clarity on the plan and not getting a straight answer.",
      bgImage: "/Homepage Cards/Leadership asking for clarity Card.png",
    },
    {
      id: "growth-stuck",
      text: "Growth stuck at week-to-week tactics with no long-term architecture.",
      bgImage: "/Homepage Cards/Growth stuck at week Card.png",
    },
  ];

  const totalItems = PATTERN_ORBIT_ITEMS.length;

  // Compute radius based on stage size (keeps center haze + cards from colliding)
  React.useEffect(() => {
    const computeRadius = () => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const stageW = rect.width;
      const stageH = rect.height;
      if (!stageW || !stageH) return;

      // Orbit stage is only visible at sm+ (>= 640). Keep cards small enough to stay
      // fully contained in the fixed stage height without overlapping the center haze.
      const isMd = stageW >= 768;
      const currentCardSize = isMd ? 165 : 150; // matches w/h below
      const centerSize = isMd ? 165 : 150; // matches center haze below
      setCardSize(currentCardSize);

      const safetyGap = 18;
      const minRadiusFromCenter = centerSize / 2 + currentCardSize / 2 + safetyGap;

      // For 6 items, chord length = 2r*sin(pi/6) = r. So r >= cardSize + gap.
      const minRadiusFromCards = currentCardSize + 24;
      const minRadius = Math.max(minRadiusFromCenter, minRadiusFromCards);

      const maxRadius = Math.min(stageW, stageH) / 2 - currentCardSize / 2 - 10;
      const targetRadius = isMd ? 210 : 195;
      const next = Math.max(minRadius, Math.min(maxRadius, targetRadius));
      setComputedRadius(next);
    };

    computeRadius();
    const ro = new ResizeObserver(computeRadius);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("resize", computeRadius);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", computeRadius);
    };
  }, []);

  const shouldRun = isRunning && !prefersReducedMotion;

  return (
    <>
      <style>{`
        @keyframes orbitSpin {
          from { transform: translate(-50%, -50%) rotate(0deg); }
          to   { transform: translate(-50%, -50%) rotate(360deg); }
        }

        @keyframes orbitCounterSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>

      {/* Desktop/Tablet Orbit (runs ONLY on hover/focus) */}
      <div
        ref={stageRef}
        className="relative w-full max-w-[980px] h-[520px] md:h-[560px] mx-auto hidden sm:block"
        onPointerEnter={() => setIsRunning(true)}
        onPointerLeave={() => {
          if (!stageRef.current?.contains(document.activeElement)) {
            setIsRunning(false);
          }
        }}
        onFocusCapture={() => setIsRunning(true)}
        onBlurCapture={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) {
            setIsRunning(false);
          }
        }}
      >
        {/* Orbit system background - radial glow, SVG rings, spark dots - centered */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
          {/* Radial glow (gold → transparent) */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{
              width: `${computedRadius * 2.2}px`,
              height: `${computedRadius * 2.2}px`,
              background:
                "radial-gradient(circle, rgba(212, 164, 95, 0.08) 0%, transparent 70%)",
            }}
          />

          {/* SVG orbit rings (cannot clip) */}
          {(() => {
            const cardRadius = cardSize / 2;
            const ringSize = (computedRadius + cardRadius + 18) * 2;
            const center = ringSize / 2;
            return (
              <svg
                width={ringSize}
                height={ringSize}
                viewBox={`0 0 ${ringSize} ${ringSize}`}
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ overflow: "visible" }}
              >
                {/* Main orbit ring */}
                <circle
                  cx={center}
                  cy={center}
                  r={computedRadius}
                  fill="none"
                  stroke="rgba(212, 164, 95, 0.15)"
                  strokeWidth="1"
                />
                {/* Outer accent ring */}
                <circle
                  cx={center}
                  cy={center}
                  r={computedRadius + 18}
                  fill="none"
                  stroke="rgba(212, 164, 95, 0.10)"
                  strokeWidth="1"
                />
              </svg>
            );
          })()}

          {/* Subtle spark dots */}
          {[0, 60, 120, 180, 240, 300].map((a, i) => {
            const radian = (a * Math.PI) / 180;
            const dotRadius = computedRadius * 0.95;
            const x = dotRadius * Math.cos(radian);
            const y = dotRadius * Math.sin(radian);
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 w-1 h-1 rounded-full bg-[#d4a45f]/20"
                style={{
                  transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                }}
              />
            );
          })}
        </div>

        {/* Rotating ring (animation always present; only play-state toggles) */}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            animation: "orbitSpin 36s linear infinite",
            animationPlayState: shouldRun ? "running" : "paused",
            willChange: "transform",
          }}
        >
          {PATTERN_ORBIT_ITEMS.map((item, index) => {
            const angle = (index * 360) / totalItems;
            return (
              <div
                key={item.id}
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${angle}deg) translateX(${computedRadius}px)`,
                  transformOrigin: "center",
                }}
              >
                {/* Upright wrapper (cancels placement rotation) */}
                <div
                  style={{
                    transform: `rotate(${-angle}deg)`,
                    transformOrigin: "center",
                  }}
                >
                  {/* Counter-spin wrapper (cancels ring rotation; always present) */}
                  <div
                    style={{
                      animation: "orbitCounterSpin 36s linear infinite",
                      animationPlayState: shouldRun ? "running" : "paused",
                      willChange: "transform",
                    }}
                  >
                    {/* Orbit card */}
                    <div
                      tabIndex={0}
                      role="button"
                      aria-label={item.text}
                      className="group relative w-[150px] h-[150px] md:w-[165px] md:h-[165px] rounded-full overflow-hidden select-none antialiased focus:outline-none focus-visible:ring-2 focus-visible:ring-black/30 transition-transform duration-200 hover:scale-[1.05] focus:scale-[1.05]"
                      style={{
                        backgroundImage: `url('${item.bgImage}')`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        backgroundRepeat: "no-repeat",
                        boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
                        outline: "1px solid rgba(255,255,255,0.08)",
                      }}
                      onPointerEnter={() => setIsRunning(true)}
                      onPointerLeave={() => {
                        if (!stageRef.current?.matches(":hover") && !stageRef.current?.contains(document.activeElement)) {
                          setIsRunning(false);
                        }
                      }}
                      onFocus={() => setIsRunning(true)}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          if (!stageRef.current?.matches(":hover") && !stageRef.current?.contains(document.activeElement)) {
                            setIsRunning(false);
                          }
                        }
                      }}
                    >
                      {/* Subtle vignette overlay (keeps images crisp, improves text contrast) */}
                      <div
                        className="absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(circle at 50% 45%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.70) 100%)",
                        }}
                      />

                      {/* Text content (no transforms, full text visible) */}
                      <div
                        className="relative z-10 h-full w-full flex items-center justify-center text-center px-6 py-5 md:px-7 md:py-6 max-w-[90%]"
                        style={{ transform: "none" }}
                      >
                        <p
                          className="text-white font-semibold text-[13px] md:text-[14px] leading-snug tracking-tight max-w-[90%] mx-auto"
                          style={{ 
                            textShadow: "0 2px 12px rgba(0,0,0,0.80)",
                          }}
                        >
                          {item.text}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Center white haze circle (locked to center; never drifts) */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none w-[150px] h-[150px] md:w-[165px] md:h-[165px]">
          <div
            className="w-full h-full rounded-full flex items-center justify-center shadow-[0_20px_60px_rgba(0,0,0,0.12)] backdrop-blur-md ring-1 ring-black/5"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, rgba(255,255,255,0.96), rgba(255,255,255,0.72) 55%, rgba(255,255,255,0.35) 78%, rgba(255,255,255,0.0) 100%)",
            }}
          >
            <p className="text-xs sm:text-sm md:text-base font-semibold text-neutral-900 text-center leading-relaxed px-4 max-w-[90%]">
              If these sound familiar, you're in the right place.
            </p>
          </div>
        </div>
      </div>

      {/* Mobile fallback: vertical stack - crisp images */}
      <div className="sm:hidden space-y-4">
        {PATTERN_ORBIT_ITEMS.map((item) => (
          <div
            key={item.id}
            className="relative overflow-hidden rounded-2xl shadow-[0_18px_45px_rgba(0,0,0,0.22)] ring-1 ring-black/10"
          >
            {/* Background image layer - crisp */}
            <div 
              className="absolute inset-0"
              style={{
                backgroundImage: `url('${item.bgImage}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }}
            />
            
            {/* Light radial vignette overlay - mild for clarity */}
            <div 
              className="absolute inset-0"
              style={{
                background: 'radial-gradient(circle at center, rgba(0,0,0,0.35), rgba(0,0,0,0.55))',
              }}
            />
            
            {/* Text content */}
            <div className="relative z-10 p-5 flex items-center justify-center min-h-[100px]">
              <p
                className="text-sm text-white font-medium leading-relaxed text-center drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]"
              >
                {item.text}
              </p>
            </div>
          </div>
        ))}
        <div className="mt-4 bg-white/70 backdrop-blur-md ring-1 ring-black/10 shadow-lg rounded-full px-6 py-3 mx-auto max-w-sm">
          <p className="text-sm font-semibold text-neutral-900 text-center leading-relaxed">
            If these sound familiar, you're in the right place.
          </p>
        </div>
      </div>
    </>
  );
}

// Common Problems Section Component
function CommonProblemsSection({ goToQuestionnaire }) {
  return (
    <section className="py-16 bg-[#f7efe6]">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500">
            Problems we solve
          </p>
          <h2 className="mt-2 text-xl sm:text-2xl font-semibold text-neutral-900">
            The patterns we fix again and again
          </h2>
          <p className="mt-2 text-sm text-neutral-700 max-w-2xl mx-auto text-center">
            ReGeneLuxe was built for operators who are tired of random tests and one-off wins, and want a system that compounds results over time.
          </p>
        </div>

        {/* Orbit module */}
        <PatternOrbit />

        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={goToQuestionnaire}
            className="px-6 py-2.5 rounded-full bg-neutral-900 text-sm font-semibold text-white tracking-wide hover:bg-black transition-colors"
          >
            Use the questionnaire to map your specific situation →
          </button>
        </div>
      </div>
    </section>
  );
}

// Mini Demo Tiles Component
function MiniDemoTiles({ goToQuestionnaire }) {
  const demoTiles = [
    {
      id: "campaign-blueprint",
      label: "Campaign blueprint",
      body: "See how a full-funnel spine is mapped from offer to channel.",
      bgImage: "/Homepage Cards/Campaign Blueprint Card.png",
    },
    {
      id: "message-map",
      label: "Message map",
      body: "How key angles flow into ads, emails, and landing pages.",
      bgImage: "/Homepage Cards/Message Map Card.png",
    },
    {
      id: "launch-calendar",
      label: "Launch calendar",
      body: "A quarter mapped out with sequenced campaigns, not random sends.",
      bgImage: "/Homepage Cards/Launch Calendar Card.png",
    },
  ];

  return (
    <section className="py-12 bg-[#f4eee7]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 sm:grid-cols-3">
          {demoTiles.map((tile, index) => (
            <motion.div
              key={tile.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: index * 0.05 }}
              className="relative overflow-hidden rounded-2xl border border-[#f0e2d2] hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15,10,5,0.18)] transition-transform"
              style={{
                backgroundImage: tile.bgImage ? `url('${tile.bgImage}')` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
                backgroundRepeat: "no-repeat",
              }}
            >
              {/* Very light gradient overlay - subtle, preserves image clarity */}
              {tile.bgImage && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/15 via-transparent to-black/8" />
              )}
              
              {/* Soft, rounded inner content panel for text legibility */}
              <div className="relative z-10 p-4 sm:p-5 md:p-6">
                <div 
                  className="max-w-[75%] sm:max-w-[70%] rounded-xl backdrop-blur-sm ring-1 ring-black/5 shadow-sm"
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.88)",
                  }}
                >
                  <div className="p-4 sm:p-5">
                    <p className="text-xs tracking-[0.18em] uppercase text-neutral-500 mb-1.5 sm:mb-2">
                      {tile.label}
                    </p>
                    <p className="text-sm sm:text-base text-neutral-800 leading-relaxed">
                      {tile.body}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        
        {/* Standalone line below the cards */}
        <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500 text-center mt-6">
          Crafted automatically from your ReGeneLuxe blueprint.
        </p>
      </div>
    </section>
  );
}

