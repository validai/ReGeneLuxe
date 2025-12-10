// src/components/FadeSection.jsx
import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeUpVariant } from "../utils/motionConfig";

export default function FadeSection({ children, className = "", delay = 0, ...rest }) {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    amount: 0.2,
    once: true,
  });

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return (
      <section ref={ref} className={className} {...rest}>
        {children}
      </section>
    );
  }

  return (
    <motion.section
      ref={ref}
      className={className}
      variants={fadeUpVariant}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      transition={{ ...fadeUpVariant.visible.transition, delay }}
      {...rest}
    >
      {children}
    </motion.section>
  );
}
