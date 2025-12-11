// FILE: src/sections/home/FounderNote.jsx
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

export default function FounderNote() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <FadeSection>
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
        <motion.div
          className="relative rounded-2xl border border-rl_border/50 bg-rl_surface/60 px-8 py-10"
          initial={prefersReducedMotion ? {} : { opacity: 0, scale: 0.98 }}
          whileInView={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={baseTransition}
        >
          {/* Top accent bar */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rl_accent/40 to-transparent rounded-t-2xl" />

          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-rl_muted">
              From the ReGeneLuxe desk
            </p>

            <p className="text-sm md:text-base text-rl_text leading-relaxed">
              ReGeneLuxe exists for operators who want elite clarity before they pour
              more spend into the machine. We've seen too many great offers buried under chaotic
              execution. You bring the product. We create the engine that sells it. This is your space to slow down, design the story properly, and then go
              loud with confidence.
            </p>

            <div className="pt-4 border-t border-rl_border/30">
              <p className="text-sm font-medium text-rl_text">
                — ReGeneLuxe Studio
              </p>
              <div className="mt-1 h-[1px] w-16 bg-rl_accent/30" />
            </div>
          </div>
        </motion.div>
      </div>
    </FadeSection>
  );
}

