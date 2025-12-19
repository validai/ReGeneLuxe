// FILE: src/sections/home/FitCheckPanel.jsx
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import FadeSection from "../../components/FadeSection";
import { baseTransition } from "../../utils/motionConfig";

const fitItems = [
  { title: "You treat campaigns like assets, not band-aids." },
  { title: "You're tired of random tests with no story behind them." },
  {
    title: "You have offers that already work, but want signature polish.",
    sub: "We amplify what's working, not rebuild from scratch.",
  },
  { title: "You value brand safety, compliance, and long-term trust." },
  {
    title: "You'd rather over-prepare once than scramble every launch.",
    sub: "Slow down to design, then go loud with confidence.",
  },
];

export default function FitCheckPanel() {
  const navigate = useNavigate();
  
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
    <section className="py-16 bg-[#f4eee7]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.16)] border border-[#f0e2d2] px-6 py-8 sm:px-10 sm:py-10">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-semibold text-neutral-900 text-center">
              Is ReGeneLuxe a fit for you?
            </h2>
            <p className="mt-2 text-sm text-neutral-700 text-center max-w-2xl mx-auto">
              We're the right partner if you see yourself in most of these.
            </p>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2">
            {fitItems.map((item, index) => (
              <div key={index} className="flex items-start gap-3">
                <div className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#e9d4b9] text-[#936533] text-sm">
                  ✓
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-900">
                    {item.title}
                  </p>
                  {item.sub && (
                    <p className="text-xs text-neutral-600 italic mt-1">
                      {item.sub}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <button
              onClick={() => navigate("/gate")}
              className="px-6 py-2.5 rounded-full bg-[#c5955a] text-sm font-semibold text-white tracking-wide shadow-md shadow-black/20 hover:bg-[#d2a46a] transition-colors"
            >
              If that sounds like you, the questionnaire is your next move.
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

