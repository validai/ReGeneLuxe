/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // ReGeneLuxe core palette – clean, Squarespace-inspired
        rl_bg: "#f7f5f2",      // soft off-white background
        rl_ink: "#111111",     // near-black text
        rl_muted: "#7a7467",   // warm muted gray
        rl_accent: "#2f5fff",  // subtle modern accent
        rl_soft: "#e1d4c4",    // soft sand for cards/sections
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "SF Pro Text", "Inter", "sans-serif"],
        display: ["system-ui", "-apple-system", "SF Pro Display", "Inter", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      boxShadow: {
        rl_soft: "0 24px 60px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
