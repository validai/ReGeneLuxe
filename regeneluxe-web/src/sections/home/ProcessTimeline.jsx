// FILE: src/sections/home/ProcessTimeline.jsx
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

const steps = [
  {
    number: "01",
    title: "Presidential Questionnaire",
    description: "We turn your messy context into a structured intake your team actually enjoys filling out.",
  },
  {
    number: "02",
    title: "Drafting Room Blueprint",
    description: "Our AI + strategist engine designs a presidential-grade campaign architecture.",
  },
  {
    number: "03",
    title: "Asset & Channel Map",
    description: "We map messages, angles, and assets across your paid + owned channels.",
  },
  {
    number: "04",
    title: "Hand-off & Iteration",
    description: "You walk away with a tested plan, not just pretty slides.",
  },
];

export default function ProcessTimeline() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.1,
      },
    },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: baseTransition,
    },
  };

  const hoverVariants = {
    rest: { y: 0, boxShadow: "0 8px 32px rgba(43,43,43,0.08)" },
    hover: {
      y: -4,
      boxShadow: "0 12px 40px rgba(203,173,141,0.15)",
      transition: { duration: 0.3 },
    },
  };

  return (
    <FadeSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-rl_muted mb-2">
            How It Works
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-rl_text">
            How ReGeneLuxe works in four moves
          </h2>
        </div>

        <motion.div
          className="relative"
          variants={prefersReducedMotion ? undefined : containerVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          whileInView={prefersReducedMotion ? undefined : "visible"}
          viewport={{ once: true, margin: "-10%" }}
        >
          {/* Connecting line on desktop */}
          <div className="hidden lg:block absolute top-12 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-rl_accent/30 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                className="relative"
                variants={prefersReducedMotion ? undefined : cardVariants}
              >
                <motion.div
                  className="rounded-2xl border border-rl_border bg-rl_surface px-6 py-6 h-full"
                  whileHover={
                    prefersReducedMotion
                      ? {}
                      : {
                          y: -4,
                          boxShadow: "0 12px 40px rgba(203,173,141,0.15)",
                          transition: { duration: 0.3 },
                        }
                  }
                >
                  {/* Step number in gold circle */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center justify-center w-10 h-10 rounded-full bg-rl_accent/20 border border-rl_accent/40">
                      <span className="text-xs font-semibold text-rl_accent">{step.number}</span>
                    </div>
                    <div className="h-[1px] flex-1 bg-rl_border hidden lg:block" />
                  </div>

                  <h3 className="text-base font-semibold text-rl_text mb-2">{step.title}</h3>
                  <p className="text-sm text-rl_muted leading-relaxed">{step.description}</p>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </FadeSection>
  );
}

