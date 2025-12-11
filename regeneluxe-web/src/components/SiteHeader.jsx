// FILE: src/components/SiteHeader.jsx
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Drafts } from "../utils/drafts";
import { Analytics } from "../utils/analytics";
import { EVENTS } from "../utils/analyticsEvents";
import { fadeInVariant } from "../utils/motionConfig";
import BrandTitle from "./BrandTitle";

export default function SiteHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);

  const authed = Auth.isSignedIn();
  const email = Auth.user();
  const onboarded = email ? Onboarding.isDone(email) : false;

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 16);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleLogoClick = (e) => {
    e.preventDefault();
    Analytics.event("header_logo_click");
    navigate("/");
  };

  const handleSignOut = () => {
    try {
      const currentEmail = Auth.user();

      Analytics.event("header_sign_out_clicked", {
        email: currentEmail || null,
        onboarded: currentEmail ? Onboarding.isDone(currentEmail) : false,
      });

      // We intentionally DO NOT clear onboarding here.
      // Onboarding is a durable state that survives sign-outs.
      if (currentEmail) {
        try {
          Drafts.clear(currentEmail);
        } catch (draftErr) {
          Analytics.error("header_sign_out_draft_clear_error", {
            message: draftErr?.message,
            name: draftErr?.name,
          });
        }
      }

      Auth.signOut();

      Analytics.event("header_sign_out_completed");

      navigate("/", { replace: true });
    } catch (e) {
      Analytics.error("header_sign_out_error", {
        message: e?.message,
        name: e?.name,
      });
      navigate("/", { replace: true });
    }
  };

  const user = authed ? { email } : null;

  const goToStart = () => {
    Analytics.track(EVENTS.CTA_CLICK, {
      label: "Start questionnaire",
      source: "top_nav",
    });
    // START QUESTIONNAIRE: navigate(user ? "/start" : "/login")
    navigate(user ? "/start" : "/login");
  };

  const goToLogin = () => {
    Analytics.track(EVENTS.CTA_CLICK, {
      label: "Sign in",
      source: "top_nav",
    });
    // SIGN IN: navigate(user ? "/dashboard" : "/login")
    navigate(user ? "/dashboard" : "/login");
  };

  const goToDashboard = () => {
    Analytics.event("header_nav_click", {
      target: "/dashboard",
      authed,
      onboarded,
    });
    // DASHBOARD: navigate("/dashboard")
    navigate("/dashboard");
  };

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const headerContent = (
    <div className={`mx-auto max-w-shell px-4 sm:px-6 lg:px-8 flex items-center justify-between transition-all duration-300 ${
      scrolled ? "h-14" : "h-16"
    }`}>
      {/* Brand / Logo */}
      <button
        type="button"
        onClick={handleLogoClick}
        className="group flex items-center gap-2"
      >
        <BrandTitle
          variant="header"
          className="tracking-[0.25em] text-xs sm:text-sm text-rl_muted"
        />
      </button>

      {/* Right-side actions */}
      <div className="flex items-center gap-4">
        {/* If NOT signed in: show Start + Sign In */}
        {!authed && (
          <>
            <motion.button
              type="button"
              onClick={goToStart}
              className="hidden text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors sm:inline-flex relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              START QUESTIONNAIRE
            </motion.button>
            <motion.button
              type="button"
              onClick={goToLogin}
              className="rounded-full bg-rl_accent px-4 py-2 text-xs font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-[0_18px_35px_rgba(15,23,42,0.12)] transition-all hover:-translate-y-[1px] active:translate-y-[1px]"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              SIGN IN
            </motion.button>
          </>
        )}

        {/* Signed in but NOT onboarded: continue onboarding + Sign Out */}
        {authed && !onboarded && (
          <>
            <motion.button
              type="button"
              onClick={goToStart}
              className="hidden text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors sm:inline-flex"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              CONTINUE ONBOARDING
            </motion.button>
            <motion.button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              SIGN OUT
            </motion.button>
          </>
        )}

        {/* Signed in AND onboarded: Dashboard + Sign Out */}
        {authed && onboarded && (
          <>
            <motion.button
              type="button"
              onClick={goToDashboard}
              className="hidden text-xs font-medium tracking-[0.2em] sm:inline-flex relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <span className={location.pathname === "/dashboard" ? "text-rl_text font-semibold" : "text-rl_muted hover:text-rl_text transition-colors"}>
                DASHBOARD
              </span>
              {location.pathname === "/dashboard" && (
                <motion.span
                  className="absolute bottom-0 left-0 right-0 h-[1px] bg-rl_accent"
                  layoutId="header-underline"
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 0.3 }}
                />
              )}
            </motion.button>
            <motion.button
              type="button"
              onClick={handleSignOut}
              className="text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              SIGN OUT
            </motion.button>
          </>
        )}
      </div>
    </div>
  );

  if (prefersReducedMotion) {
    return (
      <header className={`sticky top-0 z-40 border-b border-rl_border bg-rl_surface/95 backdrop-blur ${
        scrolled ? "shadow-[0_12px_30px_rgba(15,23,42,0.06)]" : ""
      }`}>
        {headerContent}
      </header>
    );
  }

  return (
    <motion.header
      className={`sticky top-0 z-40 border-b border-rl_border backdrop-blur ${
        scrolled ? "bg-rl_surface/98 shadow-[0_12px_30px_rgba(15,23,42,0.06)]" : "bg-rl_surface/95"
      }`}
      variants={fadeInVariant}
      initial="hidden"
      animate="visible"
    >
      {headerContent}
    </motion.header>
  );
}
