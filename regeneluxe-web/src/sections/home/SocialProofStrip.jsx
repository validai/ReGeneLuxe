// FILE: src/sections/home/SocialProofStrip.jsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";

const SLOGANS = [
  "Built to outperform agencies. Powered by elite AI orchestration.",
  "Turn noisy ad accounts into a single, readable signal.",
  "Give your media spend a strategy layer it never had.",
  "Less guessing, more lift across every channel."
];

export default function SocialProofStrip() {
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    const id = setInterval(
      () => setIndex((prev) => (prev + 1) % SLOGANS.length),
      5500
    );
    return () => clearInterval(id);
  }, []);

  const currentSlogan = SLOGANS[index];

  return (
    <section className="w-full bg-rl_bg px-4 pb-12 pt-4 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl rounded-3xl border border-rl_border/40 bg-rl_surface/95 px-5 py-5 shadow-rl_soft sm:px-7 sm:py-6 lg:px-8 lg:py-7">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* LEFT CARD – Trusted by operators */}
          <div className="h-full">
            <div className="h-full rounded-2xl border border-rl_border/40 bg-rl_surfaceSoft/80 px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
              <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.22em] text-rl_muted uppercase">
                Trusted by operators from
              </p>
              <ul className="space-y-3 text-[0.95rem] font-medium leading-relaxed text-rl_text">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent" />
                  <span>DTC brands running serious paid social.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/80" />
                  <span>Course creators and infoproduct founders.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/70" />
                  <span>Lean agencies who need a smarter engine.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/60" />
                  <span>Solo operators stitching channels together.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* MIDDLE – Rotating slogans with background image */}
          <div
            className="relative h-full rounded-2xl overflow-hidden flex items-start justify-center px-8 py-20 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: "url('/Futuristic AI Advertising Holograms Visual 2.png')",
            }}
          >
            {/* Darker overlay for better text contrast */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

            {/* Content */}
            <div className="relative z-10 text-center max-w-md mx-auto">
              <h3 className="uppercase tracking-widest text-xs text-white/70 mb-4 drop-shadow-lg">
                Why operators choose ReGeneLuxe
              </h3>

              <div className="min-h-[4.5rem]">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={currentSlogan}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className="text-2xl font-semibold italic leading-snug text-white drop-shadow-2xl"
                  >
                    {currentSlogan}
                  </motion.p>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* RIGHT CARD – Typical lift we design for */}
          <div className="h-full">
            <div className="h-full rounded-2xl border border-rl_border/40 bg-rl_surfaceSoft/80 px-4 py-4 sm:px-5 sm:py-5 shadow-sm">
              <p className="mb-3 text-[0.7rem] font-semibold tracking-[0.22em] text-rl_muted uppercase text-left">
                Typical lift we design for
              </p>

              <div className="space-y-3">
                {/* ROAS */}
                <div className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-rl_accent/10 text-[0.68rem] font-semibold text-rl_accent">
                    ↑
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-rl_text">
                      ROAS
                      <span className="ml-2 text-[0.64rem] font-normal text-rl_muted uppercase tracking-[0.18em]">
                        (Return on Ad Spend)
                      </span>
                    </p>
                    <p className="text-[0.74rem] leading-snug text-rl_muted">
                      3–5x clarity on which campaigns actually print money, not
                      just drive cheap clicks.
                    </p>
                  </div>
                </div>

                {/* CAC */}
                <div className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-rl_accent/10 text-[0.68rem] font-semibold text-rl_accent">
                    ↓
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-rl_text">
                      CAC
                      <span className="ml-2 text-[0.64rem] font-normal text-rl_muted uppercase tracking-[0.18em]">
                        (Customer Acquisition Cost)
                      </span>
                    </p>
                    <p className="text-[0.74rem] leading-snug text-rl_muted">
                      20–40% CAC reduction by cutting wasted audiences and
                      creatives that don’t convert.
                    </p>
                  </div>
                </div>

                {/* LTV */}
                <div className="flex gap-3">
                  <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-rl_accent/10 text-[0.68rem] font-semibold text-rl_accent">
                    ◎
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-rl_text">
                      LTV clarity
                      <span className="ml-2 text-[0.64rem] font-normal text-rl_muted uppercase tracking-[0.18em]">
                        (Lifetime Value)
                      </span>
                    </p>
                    <p className="text-[0.74rem] leading-snug text-rl_muted">
                      Full-funnel mapping so you can see long-term revenue, not
                      just week-one sales spikes.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* END RIGHT CARD */}
        </div>
      </div>
    </section>
  );
}
