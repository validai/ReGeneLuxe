// FILE: src/components/Showcase.jsx
// Minimal, dependency-free carousel with fade.
// Uses /public/showcase/*.png files in public/showcase/

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const IMAGES = [
  "/showcase/result-image-1.png",
  "/showcase/result-image-2.png",
  "/showcase/result-image-3.png",
  "/showcase/result-image-4.png",
  "/showcase/result-image-5.png",
  "/showcase/result-image-6.png",
  "/showcase/result-image-7.png",
  "/showcase/result-image-8.png",
  "/showcase/result-image-9.png",
];

export default function Showcase({ className = "" }) {
  const [images] = useState(IMAGES);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Slower autoplay - 10 seconds per image
  const AUTOPLAY_INTERVAL = 10000;

  // Autoplay
  useEffect(() => {
    if (!images || images.length === 0) return undefined;

    const id = setInterval(
      () => setIdx((n) => ((n + 1) % images.length + images.length) % images.length),
      AUTOPLAY_INTERVAL
    );
    return () => clearInterval(id);
  }, [images]);

  // Progress bar animation
  useEffect(() => {
    if (prefersReducedMotion) return;

    setProgress(0);
    const progressId = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          return 0;
        }
        // 10000ms / 100 = 100 steps at 100ms intervals
        return prev + (100 / (AUTOPLAY_INTERVAL / 100));
      });
    }, 100);

    return () => clearInterval(progressId);
  }, [idx, prefersReducedMotion]);

  const next = () => {
    if (!images || images.length === 0) return;
    setIdx((n) => ((n + 1) % images.length + images.length) % images.length);
  };

  const prev = () => {
    if (!images || images.length === 0) return;
    setIdx((n) => ((n - 1 + images.length) % images.length + images.length) % images.length);
  };

  if (!images || images.length === 0) {
    return null;
  }

  return (
    <section className={className}>
      <p className="text-[0.7rem] tracking-[0.3em] uppercase text-neutral-500 mb-4">
        A glimpse of the output
      </p>
      <p className="text-sm text-neutral-700 mb-6">
        A look at the kind of systems and campaigns ReGeneLuxe builds for your team.
      </p>

      <div className="relative rounded-3xl overflow-hidden shadow-[0_22px_60px_rgba(15,10,5,0.35)] border border-black/10 bg-black">
        <div className="relative aspect-[16/9]">
          <AnimatePresence>
            <motion.img
              key={images[idx]}
              src={images[idx]}
              alt={`ReGeneLuxe campaign output mock ${idx + 1}`}
              className="absolute inset-0 h-full w-full object-cover"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 1.2,
                ease: [0.22, 1, 0.36, 1],
              }}
              loading="lazy"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </AnimatePresence>

          {/* Controls */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-colors"
            aria-label="Previous"
          >
            ◀
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 backdrop-blur-sm transition-colors"
            aria-label="Next"
          >
            ▶
          </button>
        </div>

        {/* Progress bar dots */}
        <div className="mt-4 flex items-center justify-center gap-2 pb-4">
          {images.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === idx
                  ? "w-8 bg-neutral-900"
                  : "w-3 bg-neutral-400/60 hover:bg-neutral-600"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
