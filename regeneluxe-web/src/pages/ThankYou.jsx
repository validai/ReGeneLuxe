import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import FadeSection from "../components/FadeSection";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";

const ThankYou = () => {
  const navigate = useNavigate();
  // Route guards in App.jsx handle all redirects

  console.log("[ThankYou] mounted");

  return (
    <div className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 flex items-center justify-center">
        <FadeSection className="mx-4 max-w-lg w-full">
          <div className="rounded-2xl border border-rl_border bg-rl_surface px-8 py-10 text-center shadow-rl_soft">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-rl_muted">
              Onboarding Complete
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
              Thank you for trusting ReGeneLuxe.
            </h1>
            <p className="mt-3 text-sm text-rl_muted">
              Your onboarding profile is now locked in. We&apos;ll use this to shape
              your first campaign blueprint and keep every recommendation aligned
              with how you actually operate.
            </p>

            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  Analytics.event("thank_you_to_dashboard");
                  navigate("/dashboard");
                }}
                className="w-full inline-flex items-center justify-center rounded-full border border-rl_border px-5 py-2 text-xs font-medium tracking-[0.2em] text-rl_muted hover:text-rl_text transition-colors"
              >
                GO TO DASHBOARD
              </button>
              <button
                type="button"
                onClick={() => {
                  Analytics.event("thank_you_to_new_campaign");
                  navigate("/campaign/new");
                }}
                className="w-full inline-flex items-center justify-center rounded-full bg-rl_accent px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] text-rl_bg shadow-rl_soft hover:shadow-md transition-all"
              >
                CREATE NEW CAMPAIGN
              </button>
            </div>
          </div>
        </FadeSection>
    </div>
  );
};

export default ThankYou;
