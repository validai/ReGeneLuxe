// FILE: src/utils/motionConfig.js
export const baseTransition = {
  duration: 0.45,
  ease: [0.22, 0.61, 0.36, 1],
};

export const fadeUpVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: baseTransition,
  },
};

export const fadeInVariant = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: baseTransition,
  },
};

export const scaleCardVariant = {
  rest: { scale: 1, y: 0, boxShadow: "0 18px 45px rgba(15, 23, 42, 0.08)" },
  hover: {
    scale: 1.02,
    y: -4,
    boxShadow: "0 22px 55px rgba(15, 23, 42, 0.12)",
    transition: { ...baseTransition, duration: 0.35 },
  },
};

