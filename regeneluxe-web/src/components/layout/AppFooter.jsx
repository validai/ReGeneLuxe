// FILE: src/components/layout/AppFooter.jsx
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import FadeSection from "../FadeSection";
import BrandTitle from "../BrandTitle";
import { baseTransition } from "../../utils/motionConfig";

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

export default function AppFooter() {

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
    <footer className="mt-16">
      <FadeSection>
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-gradient-to-t from-[#f3e7d9] via-[#faf3ea] to-[#fdf8f0] dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-900 shadow-[0_22px_60px_rgba(15,10,5,0.20)] border border-white/60 dark:border-neutral-800 pt-10 pb-8 sm:pt-12 sm:pb-10">
            {/* Four-Column Layout */}
            <div className="px-6 sm:px-8 lg:px-10">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
                {/* Column A — Brand */}
                <div>
                  <div>
                    <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400">
                      ReGeneLuxe
                    </p>
                    <p className="mt-1 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
                      Luxury campaign drafting &amp; automation
                    </p>
                    <p className="mt-4 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 max-w-xs">
                      We turn your raw marketing notes into structured, AI-ready blueprints. Your ideas become a high-converting, multi-format campaign you can run again and again.
                    </p>
                  </div>
                </div>

                {/* Column B — Platform */}
                <div className="lg:border-l lg:border-white/40 lg:dark:border-neutral-800 lg:pl-10">
                  <h4 className="text-xs tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400 mb-3">
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
                        {item.placeholder ? (
                          <span className="text-sm text-neutral-500 dark:text-neutral-500 cursor-not-allowed">
                            {item.label}
                          </span>
                        ) : (
                          <Link
                            to={item.path}
                            className="text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors duration-150"
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column C — Resources */}
                <div className="lg:border-l lg:border-white/40 lg:dark:border-neutral-800 lg:pl-10">
                  <h4 className="text-xs tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400 mb-3">
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
                        {item.placeholder ? (
                          <span className="text-sm text-neutral-500 dark:text-neutral-500 cursor-not-allowed">
                            {item.label}
                          </span>
                        ) : (
                          <Link
                            to={item.path}
                            className="text-sm text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white transition-colors duration-150"
                          >
                            {item.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Column D — Social & Trust */}
                <div className="lg:border-l lg:border-white/40 lg:dark:border-neutral-800 lg:pl-10">
                  <h4 className="text-xs tracking-[0.3em] uppercase text-neutral-500 dark:text-neutral-400 mb-3">
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
                        <a
                          key={label}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 text-neutral-800 dark:text-neutral-100 hover:bg-white hover:text-neutral-900 dark:hover:bg-neutral-800 transition-colors duration-150"
                          aria-label={label}
                        >
                          <Icon className="w-4 h-4" />
                        </a>
                      ))}
                    </div>

                    {/* Trust Badges */}
                    <div className="mt-4">
                      <p className="text-[0.7rem] tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400">
                        GDPR compliant
                      </p>
                      <p className="mt-1 text-[0.7rem] tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400">
                        PCI-safe via Stripe
                      </p>
                      <p className="mt-1 text-[0.7rem] tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400">
                        AI-driven. Human-directed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Powered by line */}
            <div className="mt-8 border-t border-white/60 dark:border-neutral-800 pt-4 px-6 sm:px-8 lg:px-10">
              <p className="text-[0.7rem] tracking-[0.22em] uppercase text-neutral-500 dark:text-neutral-400 text-center">
                Powered by ReGeneLuxe Engine v1.2 — emotion-driven AI architecture.
              </p>
            </div>

            {/* Premium Legal Row */}
            <div className="mt-4 border-t border-white/60 dark:border-neutral-800 pt-4 px-6 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-xs text-neutral-500 dark:text-neutral-400">
                <p>© 2025 ReGeneLuxe. All rights reserved.</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1">
                  {["Privacy", "Terms", "Security", "Compliance"].map((label) => (
                    <Link
                      key={label}
                      to="#"
                      className="hover:text-neutral-900 dark:hover:text-white transition-colors duration-150"
                    >
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </FadeSection>
    </footer>
  );
}

