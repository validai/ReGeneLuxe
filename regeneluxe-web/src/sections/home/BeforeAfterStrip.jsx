// FILE: src/sections/home/BeforeAfterStrip.jsx
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

const beforeItems = [
  "Random tests with no campaign spine",
  "Strategy scattered across Slack, Notion, and screenshots",
  "Last-minute launch panic",
  "No clear story for leadership",
];

const afterItems = [
  "One central presidential campaign blueprint",
  "Narrative, angles, and assets aligned across channels",
  "Launch calendar mapped by quarter",
  "Executive-ready docs that actually get sign-off",
];

export default function BeforeAfterStrip() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: baseTransition,
    },
  };

  const afterItemVariants = {
    hidden: { opacity: 0, x: 20 },
    visible: {
      opacity: 1,
      x: 0,
      transition: baseTransition,
    },
  };

  return (
    <FadeSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-3xl border border-rl_border bg-rl_surface/80 px-6 py-10 lg:px-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Before Column */}
            <div className="relative">
              <div className="lg:hidden mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-rl_muted">
                  Before ReGeneLuxe
                </h3>
              </div>
              <div className="hidden lg:block absolute top-0 right-0 w-[1px] h-full bg-rl_border" />
              <div className="space-y-4">
                <h3 className="hidden lg:block text-sm font-semibold uppercase tracking-[0.2em] text-rl_muted mb-4">
                  Before ReGeneLuxe
                </h3>
                {beforeItems.map((item, index) => (
                  <motion.div
                    key={item}
                    className="flex items-start gap-3"
                    variants={prefersReducedMotion ? undefined : itemVariants}
                    initial={prefersReducedMotion ? undefined : "hidden"}
                    whileInView={prefersReducedMotion ? undefined : "visible"}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={prefersReducedMotion ? undefined : { delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-red-300 bg-red-50 flex items-center justify-center mt-0.5">
                      <span className="text-red-400 text-xs">×</span>
                    </div>
                    <p className="text-sm text-rl_text flex-1">{item}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* After Column */}
            <div>
              <div className="lg:hidden mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-rl_muted">
                  After ReGeneLuxe
                </h3>
              </div>
              <div className="space-y-4">
                <h3 className="hidden lg:block text-sm font-semibold uppercase tracking-[0.2em] text-rl_muted mb-4">
                  After ReGeneLuxe
                </h3>
                {afterItems.map((item, index) => (
                  <motion.div
                    key={item}
                    className="flex items-start gap-3"
                    variants={prefersReducedMotion ? undefined : afterItemVariants}
                    initial={prefersReducedMotion ? undefined : "hidden"}
                    whileInView={prefersReducedMotion ? undefined : "visible"}
                    viewport={{ once: true, margin: "-20%" }}
                    transition={prefersReducedMotion ? undefined : { delay: index * 0.1 }}
                  >
                    <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-rl_accent bg-rl_accent/10 flex items-center justify-center mt-0.5">
                      <span className="text-rl_accent text-xs">✓</span>
                    </div>
                    <p className="text-sm text-rl_text flex-1">{item}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FadeSection>
  );
}

