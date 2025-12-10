// src/components/BrandTitle.jsx
import { motion } from "framer-motion";
import { baseTransition } from "../utils/motionConfig";

export default function BrandTitle({ variant = "header", className = "" }) {
  const base = "uppercase font-semibold text-rl_text relative";
  const size =
    variant === "hero"
      ? "text-3xl sm:text-4xl lg:text-5xl tracking-[0.4em]"
      : "text-xs sm:text-sm tracking-[0.25em]";

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return (
      <span className={`${base} ${size} ${className}`}>
        REGENELUXE
      </span>
    );
  }

  return (
    <motion.span
      initial={{ opacity: 0, y: variant === "hero" ? 16 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{
        letterSpacing: variant === "hero" ? "0.45em" : "0.3em",
        scale: 1.02,
      }}
      whileTap={{ scale: 0.98 }}
      transition={baseTransition}
      className={`${base} ${size} ${className}`}
    >
      REGENELUXE
      {variant === "hero" && (
        <motion.span
          className="absolute bottom-0 left-0 h-[2px] bg-rl_accent"
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ ...baseTransition, delay: 0.3 }}
        />
      )}
    </motion.span>
  );
}
