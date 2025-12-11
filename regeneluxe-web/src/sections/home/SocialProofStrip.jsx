// FILE: src/sections/home/SocialProofStrip.jsx
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

export default function SocialProofStrip() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const pillVariants = {
    rest: { scale: 1 },
    hover: {
      scale: 1.05,
      boxShadow: "0 0 12px rgba(203,173,141,0.2)",
      transition: { duration: 0.2 },
    },
  };

  return (
    <FadeSection>
      <div className="w-full bg-rl_surfaceSoft/60 border-t border-rl_accent/30 py-8">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-2xl bg-rl_surface/80 px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
              {/* Column 1: Trusted by */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                  Trusted by operators from:
                </p>
                <div className="flex flex-wrap gap-2">
                  {["DTC Brands", "Course Creators", "Agencies", "Founders"].map((tag) => (
                    <motion.span
                      key={tag}
                      className="inline-flex items-center rounded-full border border-rl_accent/30 bg-rl_surfaceSoft px-3 py-1 text-xs text-rl_text"
                      variants={prefersReducedMotion ? undefined : pillVariants}
                      initial={prefersReducedMotion ? undefined : "rest"}
                      whileHover={prefersReducedMotion ? undefined : "hover"}
                    >
                      {tag}
                    </motion.span>
                  ))}
                </div>
              </div>

              {/* Column 2: Typical lift */}
              <div className="space-y-3">
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
                  Typical lift we design for:
                </p>
                <div className="space-y-1.5">
                  {[
                    { label: "↑ ROAS", value: "3-5x clarity" },
                    { label: "↓ CAC", value: "20-40% reduction" },
                    { label: "↑ LTV clarity", value: "Full mapping" },
                  ].map((metric) => (
                    <div key={metric.label} className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-rl_accent">{metric.label}</span>
                      <span className="text-xs text-rl_muted">{metric.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Column 3: Tagline */}
              <div className="flex items-center">
                <p className="text-sm text-rl_muted italic">
                  Built to outperform agencies. Powered by elite AI orchestration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeSection>
  );
}

