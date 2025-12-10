/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rl_bg: "#F1EDE6",
        rl_surface: "#FFFFFF",
        rl_surfaceSoft: "#EBE3DB",
        rl_border: "#D1C7BD",
        rl_text: "#2B2B2B",
        rl_muted: "#7A6B5B",
        rl_accent: "#CBAD8D",
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
        rl_soft: "0 8px 32px rgba(43,43,43,0.08)",
      },
      maxWidth: {
        shell: "1120px",
      },
      borderRadius: {
        "2xl": "1.5rem",
      },
    },
  },
  plugins: [],
};
