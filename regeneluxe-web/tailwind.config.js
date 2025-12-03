/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rl_bg: "#f5f2ec", // warm, minimal off-white background
        rl_ink: "#0f172a", // main text (deep slate)
        rl_muted: "#6b7280", // secondary text
        rl_border: "rgba(15, 23, 42, 0.08)", // subtle borders
        rl_accent: "#111827", // CTA / highlights (near black)
        rl_accentSoft: "#e5e7eb", // soft accent background
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "system-ui",
          "Segoe UI",
          "sans-serif",
        ],
      },
      boxShadow: {
        rl_soft: "0 28px 80px rgba(15, 23, 42, 0.18)", // luxe floating card shadow
      },
      maxWidth: {
        container: "1120px",
      },
      borderRadius: {
        xl2: "1.5rem",
      },
      spacing: {
        section: "6.5rem",
      },
    },
  },
  plugins: [],
};
