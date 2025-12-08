import SiteHeader from "../components/SiteHeader";
import Hero from "../sections/Hero";
import HowItWorks from "../sections/HowItWorks";
import WhatItBuilds from "../sections/WhatItBuilds";

export default function Gate() {
  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <SiteHeader />
      <main className="mx-auto max-w-container px-6 pb-16 pt-12">
        <Hero />
        <div className="mt-12 rl-hairline" />
        <HowItWorks />
        <div className="mt-12 rl-hairline" />
        <WhatItBuilds />
      </main>
    </div>
  );
}
