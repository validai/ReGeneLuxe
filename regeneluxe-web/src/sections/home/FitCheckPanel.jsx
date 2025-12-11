// FILE: src/sections/home/FitCheckPanel.jsx
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

const fitItems = [
  { text: "You treat campaigns like assets, not band-aids." },
  { text: "You're tired of random tests with no story behind them." },
  {
    text: "You have offers that already work, but want signature polish.",
    helper: "We amplify what's working, not rebuild from scratch.",
  },
  { text: "You value brand safety, compliance, and long-term trust." },
  {
    text: "You'd rather over-prepare once than scramble every launch.",
    helper: "Slow down to design, then go loud with confidence.",
  },
];

export default function FitCheckPanel() {
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: baseTransition,
    },
  };

  // Use inline styles for hover instead of variants to avoid conflicts

  return (
    <FadeSection>
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="rounded-2xl border border-rl_border bg-rl_surface px-8 py-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-semibold text-rl_text mb-2">
              Is ReGeneLuxe a fit for you?
            </h2>
            <p className="text-sm md:text-base text-rl_muted">
              We're the right partner if you see yourself in most of these.
            </p>
          </div>

          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            variants={
              prefersReducedMotion
                ? undefined
                : {
                    visible: {
                      transition: {
                        staggerChildren: 0.08,
                      },
                    },
                  }
            }
          >
            {fitItems.map((item, index) => (
              <motion.div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border border-transparent transition-colors"
                variants={prefersReducedMotion ? undefined : itemVariants}
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : {
                        backgroundColor: "rgba(203,173,141,0.05)",
                        borderColor: "rgba(203,173,141,0.2)",
                        transition: { duration: 0.2 },
                      }
                }
              >
                <div className="flex-shrink-0 w-5 h-5 rounded-full border-2 border-rl_accent bg-rl_accent/10 flex items-center justify-center mt-0.5">
                  <span className="text-rl_accent text-xs">✓</span>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-rl_text">{item.text}</p>
                  {item.helper && (
                    <p className="text-xs text-rl_muted italic mt-1">{item.helper}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>

          <div className="text-center">
            <motion.p
              className="inline-block rounded-full border border-rl_accent/30 bg-rl_surfaceSoft px-6 py-2 text-sm text-rl_text"
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ ...baseTransition, delay: 0.3 }}
            >
              If that sounds like you, the questionnaire is your next move.
            </motion.p>
          </div>
        </div>
      </div>
    </FadeSection>
  );
}

