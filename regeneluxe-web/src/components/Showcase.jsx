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
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.26em] text-rl_muted">
        A glimpse of the output
      </p>

      <div className="mt-4 relative rounded-2xl border border-rl_border overflow-hidden bg-rl_surface shadow-rl_soft">
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
        </div>

        {/* Controls */}
        <motion.button
          type="button"
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-rl_surface px-3 py-1 text-xs border border-rl_border hover:bg-rl_surfaceSoft transition-colors"
          aria-label="Previous"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          ◀
        </motion.button>
        <motion.button
          type="button"
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-rl_surface px-3 py-1 text-xs border border-rl_border hover:bg-rl_surfaceSoft transition-colors"
          aria-label="Next"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          ▶
        </motion.button>

        {/* Progress bar */}
        {!prefersReducedMotion && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-rl_border overflow-hidden">
            <motion.div
              className="h-full bg-rl_accent"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.1, ease: "linear" }}
            />
          </div>
        )}

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {images.map((_, i) => (
            <motion.button
              key={i}
              type="button"
              onClick={() => setIdx(i)}
              className={`h-1.5 w-5 rounded-full ${
                i === idx ? "bg-rl_text" : "bg-rl_border"
              }`}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.2 }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
