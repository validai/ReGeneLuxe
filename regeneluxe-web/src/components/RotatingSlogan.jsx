// FILE: src/components/RotatingSlogan.jsx
import { useState, useEffect } from "react";

const SLOGANS = [
  "Launch with confidence. Your next campaign deserves elite treatment.",
  "Your ideas deserve more than visibility — they deserve results.",
  "Where your vision becomes a high-performing campaign engine.",
  "Don't just advertise. Architect momentum.",
  "Precision-built campaigns for brands that demand excellence.",
  "Sell smarter. Create less. ReGeneLuxe handles the heavy lifting.",
  "Turn ambition into automated, conversion-driven execution.",
  "From concept to completion — your campaign, perfected.",
  "Build presence. Command attention. Convert effortlessly.",
  "Campaign mastery engineered for creators who expect more.",
  "Your story deserves a campaign crafted with intention and intelligence.",
  "Elevate your brand with the most advanced campaign engine ever built.",
];

export default function RotatingSlogan() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      // Fade out
      setIsVisible(false);
      
      // After fade completes, change slogan and fade in
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % SLOGANS.length);
        setIsVisible(true);
      }, 500); // Half of transition duration
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-gradient-to-b from-[#faf6f1]/80 to-[#f3ece5]/80">
      <div className="mx-auto max-w-5xl px-6 py-6 md:py-8 transition-opacity duration-500 ease-out">
        <p
          className={`text-lg md:text-2xl font-medium tracking-tight text-[#2d2419] text-center transition-opacity duration-500 ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
          aria-live="polite"
        >
          {SLOGANS[currentIndex]}
        </p>
      </div>
    </div>
  );
}

