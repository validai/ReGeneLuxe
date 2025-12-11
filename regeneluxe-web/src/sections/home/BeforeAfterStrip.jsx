// FILE: src/sections/home/BeforeAfterStrip.jsx
import FadeSection from "../../components/FadeSection";

const transformations = [
  {
    before: "Random tests with no campaign spine",
    after: "One central signature campaign blueprint",
  },
  {
    before: "Strategy scattered across Slack, Notion, and screenshots",
    after: "Narrative, angles, and assets aligned across channels",
  },
  {
    before: "Last-minute launch panic",
    after: "Launch calendar mapped by quarter",
  },
  {
    before: "No clear story for leadership",
    after: "Executive-ready docs that actually get sign-off",
  },
];

export default function BeforeAfterStrip() {
  return (
    <FadeSection>
      <section className="max-w-5xl mx-auto px-6">
        <div className="rounded-3xl bg-white/90 border border-[#e7ddcf] shadow-sm px-6 py-7 md:px-10 md:py-9 space-y-6">
          <div className="text-xs font-semibold tracking-[0.28em] uppercase text-[#b09779]">
            The shift with ReGeneLuxe
          </div>

          <div className="space-y-4 md:space-y-5">
            {transformations.map((transformation, index) => (
              <div
                key={index}
                className="flex flex-col md:flex-row md:items-center md:gap-4"
              >
                <div className="flex-1">
                  <span className="inline-flex items-center rounded-full bg-[#ffe8e6] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-[#c8554a] mr-2">
                    Before
                  </span>
                  <span className="text-sm text-[#5b4a3a]">
                    {transformation.before}
                  </span>
                </div>
                <div className="hidden md:flex items-center justify-center text-xs font-medium text-[#b7a28b] mx-2">
                  <span>→</span>
                </div>
                <div className="flex-1 mt-2 md:mt-0">
                  <span className="inline-flex items-center rounded-full bg-[#f3e7d6] px-3 py-1 text-[11px] font-semibold tracking-[0.16em] uppercase text-[#8b7357] mr-2">
                    After
                  </span>
                  <span className="text-sm text-[#3a3127]">
                    {transformation.after}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeSection>
  );
}

