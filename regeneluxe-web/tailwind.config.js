/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        rl_bg: "rgb(var(--rl-bg) / <alpha-value>)",
        rl_surface: "rgb(var(--rl-surface) / <alpha-value>)",
        rl_surfaceRaised: "rgb(var(--rl-surface-raised) / <alpha-value>)",
        rl_surfaceSoft: "rgb(var(--rl-surface-soft) / <alpha-value>)",
        rl_surfaceHover: "rgb(var(--rl-surface-hover) / <alpha-value>)",
        rl_surfaceActive: "rgb(var(--rl-surface-active) / <alpha-value>)",
        rl_border: "rgb(var(--rl-border) / <alpha-value>)",
        rl_borderStrong: "rgb(var(--rl-border-strong) / <alpha-value>)",
        rl_text: "rgb(var(--rl-text) / <alpha-value>)",
        rl_textSecondary: "rgb(var(--rl-text-secondary) / <alpha-value>)",
        rl_muted: "rgb(var(--rl-muted) / <alpha-value>)",
        rl_accent: "rgb(var(--rl-accent) / <alpha-value>)",
        rl_accentHover: "rgb(var(--rl-accent-hover) / <alpha-value>)",
        rl_danger: "rgb(var(--rl-danger) / <alpha-value>)",
        rl_ok: "rgb(var(--rl-ok) / <alpha-value>)",
        rl_warning: "rgb(var(--rl-warning) / <alpha-value>)",
        rl_info: "rgb(var(--rl-info) / <alpha-value>)",
      },
      fontFamily: {
        sans: [
          "IBM Plex Sans",
          "Segoe UI",
          "Helvetica Neue",
          "Arial",
          "sans-serif",
        ],
        display: [
          "Fraunces",
          "IBM Plex Sans",
          "Georgia",
          "serif",
        ],
      },
      boxShadow: {
        rl_soft: "0 12px 40px rgba(0,0,0,0.28)",
        rl_sheet: "0 0 0 1px rgb(var(--rl-border) / 0.6), -24px 0 48px rgba(0,0,0,0.35)",
      },
      maxWidth: {
        shell: "1280px",
        workspace: "1440px",
        composer: "1280px",
      },
      width: {
        sidebar: "var(--rl-sidebar)",
        "sidebar-collapsed": "var(--rl-sidebar-collapsed)",
      },
      transitionDuration: {
        rl: "160ms",
      },
    },
  },
  plugins: [],
};
