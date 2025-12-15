import { motion } from "framer-motion";

const steps = [
  {
    id: 1,
    label: "INTAKE",
    step: "Step 1",
    title: "Signature Questionnaire",
    body: "We turn your messy context into a structured intake your team actually enjoys filling out.",
    iconEmoji: "📝",
  },
  {
    id: 2,
    label: "BLUEPRINT",
    step: "Step 2",
    title: "Drafting Room Blueprint",
    body: "Our AI + strategist engine designs a precision-built campaign architecture powered by elite AI orchestration.",
    iconEmoji: "🧠",
  },
  {
    id: 3,
    label: "CHANNEL MAP",
    step: "Step 3",
    title: "Asset & Channel Map",
    body: "We map messages, angles, and assets across your paid + owned channels.",
    iconEmoji: "🛰️",
  },
  {
    id: 4,
    label: "LAUNCH & ITERATE",
    step: "Step 4",
    title: "Hand-off & Iteration",
    body: "You walk away with a tested plan, not just pretty slides — and a system you can keep refining.",
    iconEmoji: "🚀",
  },
];

const shifts = [
  {
    before: "Random tests with no clear campaign plan",
    after: "One main campaign blueprint everyone uses",
    result: "Your tests build on each other instead of starting from scratch every time.",
  },
  {
    before: "Ideas scattered across Slack, Notion, and screenshots",
    after: "Story and assets lined up in one shared system",
    result: "Your team always knows where to look and works from the same story.",
  },
  {
    before: "Rushing every launch at the last minute",
    after: "Launch calendar planned out by quarter",
    result: "You get more time to test, fix issues, and improve performance.",
  },
  {
    before: "Hard to explain the plan to leadership",
    after: "Clear, executive-ready decks and docs",
    result: "Leaders understand the plan quickly and approve budgets faster.",
  },
  {
    before: "Content quality changes from team to team or project to project",
    after: "Clear creative guidelines everyone can follow",
    result: "You get steady, professional-looking content no matter who makes it.",
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
          <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-3">
            How it works
          </p>
          <h2 className="text-2xl sm:text-3xl lg:text-[2.1rem] font-semibold tracking-tight text-neutral-900">
            How ReGeneLuxe works in four moves
          </h2>
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
              {steps.map((step) => (
                <StepCard key={step.id} step={step} />
              ))}
            </div>
          </motion.div>
        </motion.div>

        {/* Shift with ReGeneLuxe */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          className="rounded-3xl bg-[#faf5ee] shadow-[0_18px_45px_rgba(15,10,5,0.09)] border border-[#f0e2d2] px-6 py-10 sm:px-10 sm:py-12"
        >
          <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-8 text-center">
            The shift with <span className="font-semibold">ReGeneLuxe</span>
          </p>

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
          <div className="space-y-4 sm:space-y-5">
            {shifts.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-[1.1fr_auto_1.1fr_1.1fr] gap-x-4 sm:gap-x-8 items-start text-sm"
              >
                {/* Before */}
                <p className="text-neutral-700 leading-relaxed">
                  {item.before}
                </p>

                {/* Arrow */}
                <div className="flex justify-center pt-1">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-neutral-300 text-base font-semibold text-neutral-500">
                    →
                  </span>
                </div>

                {/* After */}
                <p className="text-neutral-800 leading-relaxed">
                  {item.after}
                </p>

                {/* Result */}
                <p className="text-neutral-800 leading-relaxed">
                  {item.result}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function StepCard({ step }) {
  return (
    <div className="flex flex-col h-full">
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
      <h3 className="text-sm sm:text-base font-semibold text-neutral-900 mb-2">
        {step.title}
      </h3>
      <p className="text-xs sm:text-sm leading-relaxed text-neutral-700">
        {step.body}
      </p>
    </div>
  );
}

