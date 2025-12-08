// regeneluxe-web/src/components/Showcase.jsx
import { useEffect, useState } from "react";

/**
 * Minimal, dependency-free carousel with fade.
 * Put any .webp/.png/.jpg/.svg files in /public/showcase/
 */
const FALLBACKS = [
  "/showcase/result_video_scripts.svg",
  "/showcase/result_ad_bundle.svg",
  "/showcase/result_email_flow.svg",
  "/showcase/result_automation_map.svg",
];

export default function Showcase({ className = "" }) {
  const [images] = useState(FALLBACKS);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((n) => (n + 1) % images.length), 3600);
    return () => clearInterval(id);
  }, [images.length]);

  const next = () => setIdx((n) => (n + 1) % images.length);
  const prev = () => setIdx((n) => (n - 1 + images.length) % images.length);

  return (
    <section className={className}>
      <p className="text-[0.72rem] font-medium uppercase tracking-[0.26em] text-rl_muted">
        A glimpse of the output
      </p>

      <div className="mt-4 relative rounded-3xl ring-1 ring-rl_border overflow-hidden bg-white">
        {/* Slides */}
        <div className="relative aspect-[16/9]">
          {images.map((src, i) => (
            <img
              key={`${src}-${i}`}
              src={src}
              alt="ReGeneLuxe showcase"
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
                i === idx ? "opacity-100" : "opacity-0"
              }`}
              loading="lazy"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ))}
        </div>

        {/* Controls */}
        <button
          type="button"
          onClick={prev}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-xs ring-1 ring-rl_border hover:bg-white transition-colors"
          aria-label="Previous"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={next}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/80 px-3 py-1 text-xs ring-1 ring-rl_border hover:bg-white transition-colors"
          aria-label="Next"
        >
          ›
        </button>

        {/* Dots */}
        <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-2">
          {images.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-1.5 rounded-full ${
                i === idx ? "bg-black" : "bg-zinc-300"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
