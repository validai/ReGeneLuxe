// FILE: src/components/Showcase.jsx
// Minimal, dependency-free carousel with fade.
// Uses /public/showcase/*.svg files in public/showcase/

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const FALLBACKS = [
  "/showcase/result_video_snippets.svg",
  "/showcase/result_ad_bundle.svg",
  "/showcase/result_email_flow.svg",
  "/showcase/result_automation_map.svg",
];

export default function Showcase({ className = "" }) {
  const [images] = useState(FALLBACKS);
  const [idx, setIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Autoplay
  useEffect(() => {
    if (!images || images.length === 0) return undefined;

    const id = setInterval(
      () => setIdx((n) => ((n + 1) % images.length + images.length) % images.length),
      3600
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
        return prev + (100 / 36); // 3600ms / 100 = 36 steps
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
          <AnimatePresence mode="wait">
            {images.map((src, i) => (
              i === idx && (
                <motion.img
                  key={`sc-${i}`}
                  src={src}
                  alt="ReGeneLuxe showcase"
                  className="absolute inset-0 h-full w-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              )
            ))}
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
