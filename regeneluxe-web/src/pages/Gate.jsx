// FILE: src/pages/Gate.jsx
import Hero from "../sections/Hero";
import HowItWorks from "../sections/HowItWorks";
import WhatItBuilds from "../sections/WhatItBuilds";
import BeforeAfterStrip from "../sections/home/BeforeAfterStrip";
import FadeSection from "../components/FadeSection";

export default function Gate() {
  // Route guards in App.jsx handle all redirects
  // Gate is a public marketing page accessible to all

  return (
    <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <FadeSection>
          <Hero />
        </FadeSection>
        <div className="border-t border-rl_border" />
        <FadeSection>
          <HowItWorks />
        </FadeSection>
        <div className="border-t border-rl_border" />
        <FadeSection>
          <WhatItBuilds />
        </FadeSection>
        <div className="border-t border-rl_border" />
        <BeforeAfterStrip />
    </div>
  );
}
