// FILE: src/pages/Gate.jsx
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader";
import Hero from "../sections/Hero";
import HowItWorks from "../sections/HowItWorks";
import WhatItBuilds from "../sections/WhatItBuilds";
import FadeSection from "../components/FadeSection";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";

export default function Gate() {
  // Route guards in App.jsx handle all redirects
  // Gate is a public marketing page accessible to all

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
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
      </main>
    </div>
  );
}
