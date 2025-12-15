// FILE: src/components/Footer.jsx
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import FadeSection from "./FadeSection";
import BrandTitle from "./BrandTitle";
import { fadeUpVariant, baseTransition } from "../utils/motionConfig";

// Social Icons as SVG Components
const InstagramIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.23 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const LinkedinIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const YoutubeIcon = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

export default function Footer() {
  const navigate = useNavigate();

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const linkHoverVariants = {
    rest: { opacity: 0.7, scale: 1 },
    hover: {
      opacity: 1,
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  };

  return (
    <footer className="relative mt-24">
      {/* Cinematic CTA Block Above Footer */}
      <FadeSection>
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-16">
          <div className="relative overflow-hidden rounded-3xl border border-rl_accent/30 bg-gradient-to-br from-rl_surface/95 via-rl_surface/90 to-rl_surfaceSoft/80 backdrop-blur-md px-8 py-12 shadow-[0_20px_60px_rgba(203,173,141,0.15)]">
            {/* Soft spotlight gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rl_accent/5 via-transparent to-transparent pointer-events-none" />
            
            <div className="relative z-10 text-center">
              <motion.h3
                className="text-2xl sm:text-3xl md:text-4xl font-light tracking-tight text-rl_text mb-6"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...baseTransition, delay: 0.1 }}
              >
                Launch with confidence. Your next campaign deserves elite treatment.
              </motion.h3>
              
              <div className="flex flex-wrap items-center justify-center gap-4">
                <motion.button
                  onClick={() => navigate("/gate")}
                  className="relative overflow-hidden rounded-full bg-rl_accent px-8 py-3 text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(203,173,141,0.25)] transition-all hover:-translate-y-0.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="relative z-10">START QUESTIONNAIRE</span>
                  {/* Gold shimmer on hover */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: "-100%" }}
                    whileHover={{ x: "100%" }}
                    transition={{ duration: 0.6 }}
                  />
                </motion.button>
                
                <motion.button
                  onClick={() => navigate("/campaign/new")}
                  className="rounded-full border border-rl_accent/40 bg-rl_surface/60 backdrop-blur px-6 py-3 text-sm font-medium tracking-[0.18em] text-rl_text hover:bg-rl_surface/80 transition-all hover:-translate-y-0.5"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  VIEW PACKAGES
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </FadeSection>

      {/* Floating Luxury Footer Shell */}
      <FadeSection>
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Soft radial gradient behind footer */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-rl_accent/5 via-transparent to-transparent rounded-3xl pointer-events-none" />
          
          <div className="relative rounded-3xl border border-rl_accent/20 bg-gradient-to-br from-rl_surface/80 via-rl_surface/70 to-rl_surfaceSoft/60 backdrop-blur-md px-8 py-12 shadow-[0_24px_80px_rgba(203,173,141,0.12)]">
            {/* Four-Column Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
              {/* Column A — Brand */}
              <div className="space-y-4">
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  transition={{ duration: 0.2 }}
                >
                  <div>
                    <p className="text-xs tracking-[0.3em] uppercase text-neutral-500">
                      ReGeneLuxe
                    </p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900">
                      Luxury campaign drafting &amp; automation
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-neutral-700 max-w-xs">
                      We turn your raw marketing notes into structured, AI-ready blueprints. Your ideas become a high-converting, multi-format campaign you can run again and again.
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Column B — Platform */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-rl_muted mb-4">
                  Platform
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "How It Works", path: "/gate" },
                    { label: "Pricing Packages", path: "/campaign/new" },
                    { label: "Drafting Room", path: "/drafting-room" },
                    { label: "Blueprint Examples", path: "#", placeholder: true },
                  ].map((item) => (
                    <li key={item.label}>
                      <motion.div
                        variants={prefersReducedMotion ? undefined : linkHoverVariants}
                        initial={prefersReducedMotion ? undefined : "rest"}
                        whileHover={prefersReducedMotion ? undefined : "hover"}
                        className="relative inline-block"
                      >
                        {item.placeholder ? (
                          <span className="text-sm text-rl_muted/60 cursor-not-allowed">
                            {item.label}
                          </span>
                        ) : (
                          <Link
                            to={item.path}
                            className="text-sm text-rl_muted hover:text-rl_text transition-colors relative group"
                          >
                            {item.label}
                            <motion.span
                              className="absolute bottom-0 left-0 h-[1px] bg-rl_accent"
                              initial={{ width: 0 }}
                              whileHover={{ width: "100%" }}
                              transition={{ duration: 0.3 }}
                            />
                          </Link>
                        )}
                      </motion.div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column C — Resources */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-rl_muted mb-4">
                  Resources
                </h4>
                <ul className="space-y-2.5">
                  {[
                    { label: "Case Studies", path: "#", placeholder: true },
                    { label: "Blog / Insights", path: "#", placeholder: true },
                    { label: "Creator Playbooks", path: "#", placeholder: true },
                    { label: "Contact", path: "#" },
                  ].map((item) => (
                    <li key={item.label}>
                      <motion.div
                        variants={prefersReducedMotion ? undefined : linkHoverVariants}
                        initial={prefersReducedMotion ? undefined : "rest"}
                        whileHover={prefersReducedMotion ? undefined : "hover"}
                        className="relative inline-block"
                      >
                        {item.placeholder ? (
                          <span className="text-sm text-rl_muted/60 cursor-not-allowed">
                            {item.label}
                          </span>
                        ) : (
                          <Link
                            to={item.path}
                            className="text-sm text-rl_muted hover:text-rl_text transition-colors relative group"
                          >
                            {item.label}
                            <motion.span
                              className="absolute bottom-0 left-0 h-[1px] bg-rl_accent"
                              initial={{ width: 0 }}
                              whileHover={{ width: "100%" }}
                              transition={{ duration: 0.3 }}
                            />
                          </Link>
                        )}
                      </motion.div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Column D — Social & Trust */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.25em] text-rl_muted mb-4">
                  Connect
                </h4>
                <div className="space-y-4">
                  {/* Social Icons */}
                  <div className="flex items-center gap-3">
                    {[
                      { Icon: InstagramIcon, href: "#", label: "Instagram" },
                      { Icon: LinkedinIcon, href: "#", label: "LinkedIn" },
                      { Icon: YoutubeIcon, href: "#", label: "YouTube" },
                    ].map(({ Icon, href, label }) => (
                      <motion.a
                        key={label}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full border border-rl_border/40 bg-rl_surface/60 hover:bg-rl_surface transition-colors"
                        whileHover={{
                          scale: 1.1,
                          boxShadow: "0 0 10px rgba(203,173,141,0.3)",
                        }}
                        whileTap={{ scale: 0.95 }}
                        aria-label={label}
                      >
                        <Icon className="w-4 h-4 text-rl_muted hover:text-rl_accent transition-colors" />
                      </motion.a>
                    ))}
                  </div>

                  {/* Trust Badges */}
                  <div className="space-y-2 pt-2">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-rl_muted">
                      GDPR Compliant
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-rl_muted">
                      PCI-Safe via Stripe
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-rl_accent font-medium">
                      AI-Driven. Human-Directed.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* AI Signature Touch */}
            <motion.div
              className="text-center py-4 border-t border-rl_border/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...baseTransition, delay: 0.5 }}
            >
              <p className="text-[10px] uppercase tracking-[0.3em] text-rl_muted/70">
                Powered by ReGeneLuxe Engine v1.2 — emotion-driven AI architecture
              </p>
            </motion.div>

            {/* Premium Legal Row */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-rl_border/30">
              <p className="text-xs text-rl_muted/70">
                © 2025 ReGeneLuxe. All rights reserved.
              </p>
              <div className="flex items-center gap-4">
                {["Privacy", "Terms", "Security", "Compliance"].map((label) => (
                  <Link
                    key={label}
                    to="#"
                    className="text-xs text-rl_muted/70 hover:text-rl_text transition-colors"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Future-Proof Modules (Hidden) */}
            <div className="hidden">
              {/* Mini blueprint preview */}
              <div id="footer-blueprint-preview" />
              {/* Newsletter block */}
              <div id="footer-newsletter" />
              {/* AI assistant bubble */}
              <div id="footer-ai-assistant" />
              {/* Multilingual toggle */}
              <div id="footer-lang-toggle" />
            </div>
          </div>
        </div>
      </FadeSection>
    </footer>
  );
}

