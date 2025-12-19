import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const steps = [
  {
    id: 1,
    label: "INTAKE",
    step: "Step 1",
    title: "Signature Intake",
    body: "We translate your context, constraints, and goals into a clear starting point — so every decision that follows has direction.",
    iconEmoji: "📝",
  },
  {
    id: 2,
    label: "BLUEPRINT",
    step: "Step 2",
    title: "Drafting Room Blueprint",
    body: "Our AI + strategist engine designs a precise campaign structure, defining angles and variants before anything is launched.",
    iconEmoji: "🧠",
  },
  {
    id: 3,
    label: "CHANNEL MAP",
    step: "Step 3",
    title: "Asset & Channel Map",
    body: "Messages and assets are mapped across your paid and owned channels, keeping execution aligned instead of scattered.",
    iconEmoji: "🛰️",
  },
  {
    id: 4,
    label: "LAUNCH & ITERATE",
    step: "Step 4",
    title: "Launch & Iteration",
    body: "You leave with a tested plan and a clear iteration loop your team can refine over time.",
    iconEmoji: "🚀",
  },
];

const shifts = [
  {
    before: "Random tests with no clear campaign plan",
    after: "One shared campaign blueprint",
    result: "Testing builds on itself instead of restarting every launch.",
  },
  {
    before: "Ideas scattered across Slack, Notion, and screenshots",
    after: "Story and assets live in one shared system",
    result: "Teams know where to look and work from the same story.",
  },
  {
    before: "Rushing every launch at the last minute",
    after: "Launch calendars planned by quarter",
    result: "More time to test, fix issues, and improve performance.",
  },
  {
    before: "Hard to explain the plan to leadership",
    after: "Executive-ready decks and docs",
    result: "Faster approvals and clearer decisions.",
  },
  {
    before: "Inconsistent quality across teams or projects",
    after: "Clear creative guidelines everyone follows",
    result: "Professional output no matter who executes.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
};

export default function HowItWorks() {
  const navigate = useNavigate();

  const goToQuestionnaire = () => {
    navigate("/gate");
  };

  return (
    <section className="relative py-20 sm:py-24 bg-[#f4eee7]">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.3 }}
          variants={fadeUp}
          className="text-center mb-12 sm:mb-14"
        >
          <p className="text-[11px] tracking-[0.35em] uppercase text-black/50 mb-3">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold tracking-tight text-neutral-900">
            How ReGeneLuxe works in four moves
          </h2>
          <p className="mt-2 text-sm text-black/70 max-w-[720px] mx-auto leading-relaxed">
            From intake to launch in four clear steps — so your team always knows what happens next.
          </p>
        </motion.div>

        {/* Four moves */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.25 }}
          className="mb-14 sm:mb-16"
        >
          <motion.div
            variants={fadeUp}
            className="rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.12)] border border-[#f0e2d2] px-4 py-6 sm:px-8 sm:py-8"
          >
            <div className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <StepCard key={step.id} step={step} index={index} />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Inline CTA after four moves */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-700">
            Step 1 starts with your Signature Intake. You bring the context; we build the engine.
          </p>
          <button
            type="button"
            onClick={goToQuestionnaire}
            className="mt-3 px-5 py-2 rounded-full bg-[#c5955a] text-sm font-semibold text-white hover:bg-[#d2a46a] transition-colors"
          >
            Take the Signature Questionnaire →
          </button>
        </div>

        {/* Shift with ReGeneLuxe */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.09)] border border-[#f0e2d2] px-6 py-10 sm:px-10 sm:py-12"
        >
          <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-neutral-900 mb-8 text-center">
            What changes once ReGeneLuxe is in place
          </h3>

          {/* Column headers */}
          <div className="grid grid-cols-[1.1fr_auto_1.1fr_1.1fr] gap-x-4 sm:gap-x-8 mb-6 text-center">
            <span className="text-sm font-semibold tracking-wide uppercase text-[#d38927]">
              Before
            </span>

            <span></span>

            <span className="text-sm font-semibold tracking-wide uppercase text-[#5c60ff]">
              After
            </span>

            <span className="text-sm font-semibold tracking-wide uppercase text-[#1c8c4c]">
              Result
            </span>
          </div>

          {/* Rows */}
          <div className="space-y-6 sm:space-y-7">
            {shifts.map((item, index) => (
              <div
                key={index}
                tabIndex={0}
                className="grid grid-cols-[1.1fr_auto_1.1fr_1.1fr] gap-x-4 sm:gap-x-8 items-start text-sm rounded-xl p-3 -m-3 transition-colors duration-200 ease-out hover:bg-black/[0.02] focus-within:bg-black/[0.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2"
              >
                {/* Before */}
                <p className="text-neutral-700 leading-relaxed">
                  {item.before}
                </p>

                {/* Arrow */}
                <div className="flex justify-center pt-1">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-neutral-300/60 text-sm font-semibold text-black/40">
                    →
                  </span>
                </div>

                {/* After */}
                <p className="text-neutral-800 leading-relaxed">
                  {item.after}
                </p>

                {/* Result */}
                <p className="text-black/70 leading-relaxed">
                  {item.result}
                </p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Inline CTA after shift card */}
        <div className="mt-6 text-center">
          <p className="text-sm text-neutral-700">
            These shifts begin once we understand your current setup.
          </p>
          <button
            type="button"
            onClick={goToQuestionnaire}
            className="mt-2 px-5 py-2 rounded-full border border-neutral-900/10 bg-white text-sm font-medium text-neutral-900 hover:bg-neutral-900 hover:text-white transition-colors"
          >
            Start the questionnaire and see your before/after map →
          </button>
        </div>
      </div>
    </section>
  );
}

function StepCard({ step, index }) {
  // Standardized card surface styling - all steps use identical styling
  const cardSurfaceClasses = "bg-black/[0.03] ring-1 ring-black/[0.06]";

  return (
    <div
      className={`flex flex-col h-full rounded-2xl p-6 transition-all duration-300 ease-out hover:-translate-y-[1px] hover:ring-black/[0.12] focus-within:-translate-y-[1px] focus-within:ring-black/[0.12] ${cardSurfaceClasses}`}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm text-lg">
          <span aria-hidden>{step.iconEmoji}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-[0.65rem] font-semibold tracking-[0.25em] uppercase text-neutral-500">
            {step.label}
          </span>
          <span className="text-[0.7rem] text-neutral-500 mt-0.5">
            {step.step}
          </span>
        </div>
      </div>
      <h3 className="text-sm sm:text-base font-semibold text-neutral-900 mb-3">
        {step.title}
      </h3>
      <p className="text-xs sm:text-sm leading-relaxed text-neutral-700">
        {step.body}
      </p>
    </div>
  );
}

