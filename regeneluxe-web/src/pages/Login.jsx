// FILE: src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import FadeSection from "../components/FadeSection";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";

export default function Login() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  // Route guards in App.jsx handle redirects

  const submit = (e) => {
    e.preventDefault();

    if (submitting) {
      Analytics.event("login_submit_ignored_already_submitting");
      return;
    }

    if (!email) {
      Analytics.event("login_submit_empty_email");
      return;
    }

    setSubmitting(true);
    Analytics.event("login_submit_attempt", { email });

    try {
      // Sign in and let Auth normalize/store the email
      Auth.signIn(email);

      const storedEmail = Auth.user();
      const done = storedEmail ? Onboarding.isDone(storedEmail) : false;
      
      console.log("[Login] signed-in:", storedEmail, "onboarded?", done);

      Analytics.event("login_submit_success", {
        email: storedEmail,
        onboarded: done,
      });

      // POST-LOGIN RULE: Always navigate to /dashboard immediately
      navigate("/dashboard", { replace: true });
    } catch (err) {
      Analytics.error("login_submit_error", {
        message: err?.message,
        name: err?.name,
      });
      console.error("[Login] submit error", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        <FadeSection>
          <div>
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.25em] text-rl_muted">
              Sign In
            </p>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">Sign in</h1>
            <p className="mt-2 text-sm text-rl_muted max-w-2xl">
              Use your work email to access your campaign page.
            </p>
          </div>
        </FadeSection>

        <FadeSection>
          <form onSubmit={submit} className="max-w-sm space-y-4">
            <label className="block text-xs text-rl_muted">
              Work email
            </label>
            <input
              type="email"
              value={email}
              placeholder="you@brand.com"
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-rl_border bg-rl_surface px-3 py-2 text-sm text-rl_text placeholder:text-rl_muted/60 focus:outline-none focus:border-rl_accent focus:ring-1 focus:ring-rl_accent/70"
            />
            <button
              type="submit"
              disabled={submitting}
              className={`mt-2 w-full inline-flex items-center justify-center rounded-full px-6 py-2.5 text-xs md:text-sm font-semibold tracking-[0.18em] transition-all ${
                submitting
                  ? "bg-rl_border text-rl_muted cursor-not-allowed"
                  : "rounded-full bg-rl_accent text-rl_bg shadow-rl_soft hover:shadow-md"
              }`}
            >
              {submitting ? "SIGNING IN…" : "SIGN IN"}
            </button>
          </form>
        </FadeSection>
      </main>
    </div>
  );
}
