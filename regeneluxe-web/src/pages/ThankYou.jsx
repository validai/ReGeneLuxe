import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";

const ThankYou = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const email = Auth.user();
    const allowed = email && Onboarding.isDone(email);

    console.log("[ThankYou] guard check:", { email, allowed });

    if (!allowed) {
      console.warn("[ThankYou] blocked – user not onboarded, redirecting to /start");
      navigate("/start", { replace: true });
    }
  }, [navigate]);

  console.log("[ThankYou] mounted");

  return (
    <div className="min-h-screen bg-page text-rl_ink flex items-center justify-center">
      <div className="mx-4 max-w-lg rounded-3xl border border-rl_border bg-white px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rl_muted">
          Onboarding Complete
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
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
            className="w-full rounded-full border border-rl_border px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Go to Dashboard
          </button>
          <button
            type="button"
            onClick={() => {
              Analytics.event("thank_you_to_new_campaign");
              navigate("/campaign/new");
            }}
            className="w-full rounded-full bg-black px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-zinc-900"
          >
            Create New Campaign
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
