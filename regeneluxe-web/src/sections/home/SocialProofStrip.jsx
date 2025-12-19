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
    <section className="py-16 bg-[#f4eee7]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* LEFT CARD – Trusted by operators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="h-full rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.16)] border border-[#f0e2d2] px-6 py-6 sm:px-7 sm:py-7"
          >
            <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500 mb-4">
              Trusted by operators from
            </p>
            <ul className="space-y-3">
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent" />
                <span className="text-sm text-neutral-800 leading-relaxed">DTC brands running serious paid social.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/80" />
                <span className="text-sm text-neutral-800 leading-relaxed">Course creators and infoproduct founders.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/70" />
                <span className="text-sm text-neutral-800 leading-relaxed">Lean agencies who need a smarter engine.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-rl_accent/60" />
                <span className="text-sm text-neutral-800 leading-relaxed">Solo operators stitching channels together.</span>
              </li>
            </ul>
          </motion.div>

          {/* MIDDLE – Rotating slogans with background image */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
            className="relative h-full rounded-3xl overflow-hidden flex items-start justify-center px-8 py-20 bg-cover bg-center bg-no-repeat shadow-[0_18px_45px_rgba(15,10,5,0.16)]"
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
          </motion.div>

          {/* RIGHT CARD – Typical lift we design for */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.45, ease: "easeOut", delay: 0.1 }}
            className="h-full rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.16)] border border-[#f0e2d2] px-6 py-6 sm:px-7 sm:py-7"
          >
            <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500 mb-4">
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
            </motion.div>
        </div>
      </div>
    </section>
  );
}
