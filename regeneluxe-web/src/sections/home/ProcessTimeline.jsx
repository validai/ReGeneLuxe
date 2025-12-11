// FILE: src/sections/home/ProcessTimeline.jsx
import FadeSection from "../../components/FadeSection";

const steps = [
  {
    icon: "📝",
    label: "Intake",
    title: "Signature Questionnaire",
    description:
      "We turn your messy context into a structured intake your team actually enjoys filling out.",
  },
  {
    icon: "🧠",
    label: "Blueprint",
    title: "Drafting Room Blueprint",
    description:
      "Our AI + strategist engine designs a precision-built campaign architecture powered by elite AI orchestration.",
  },
  {
    icon: "🗺",
    label: "Channel Map",
    title: "Asset & Channel Map",
    description:
      "We map messages, angles, and assets across your paid + owned channels.",
  },
  {
    icon: "🚀",
    label: "Launch & Iterate",
    title: "Hand-off & Iteration",
    description:
      "You walk away with a tested plan, not just pretty slides — and a system you can keep refining.",
  },
];

export default function ProcessTimeline() {
  return (
    <FadeSection>
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-rl_muted mb-2">
            How It Works
          </p>
          <h2 className="text-2xl md:text-3xl font-semibold text-rl_text">
            How ReGeneLuxe works in four moves
          </h2>
        </div>

        <div className="mt-8 max-w-5xl mx-auto px-6">
          <div className="rounded-3xl bg-white/90 border border-[#e7ddcf] shadow-sm px-6 py-7 md:px-10 md:py-9">
            <div className="grid gap-8 md:grid-cols-4">
              {steps.map((step, index) => (
                <div key={step.title} className="relative flex flex-col">
                  {/* connector line on desktop between icons */}
                  {index < steps.length - 1 && (
                    <span className="hidden md:block absolute top-6 left-6 right-[-1.5rem] h-px bg-[#e7ddcf]" />
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f3e7d6] text-xl">
                      <span>{step.icon}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-semibold tracking-[0.24em] uppercase text-[#b09779]">
                        {step.label}
                      </span>
                      <span className="text-xs text-[#9a8570]">
                        Step {index + 1}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-[#2f251a]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-[#5b4a3a] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </FadeSection>
  );
}

