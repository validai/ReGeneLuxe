// FILE: src/pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SiteHeader from "../components/SiteHeader.jsx";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";

export default function Login() {
  const [email, setEmail] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const authed = Auth.isSignedIn();
    const userEmail = Auth.user();
    const onboarded = userEmail ? Onboarding.isDone(userEmail) : false;

    console.log("[Login] guard check:", { authed, email: userEmail, onboarded });

    if (!authed) return; // show login form for signed-out users

    if (userEmail && onboarded) {
      console.warn("[Login] already onboarded → redirecting to /dashboard");
      navigate("/dashboard", { replace: true });
      return;
    }

    if (userEmail && !onboarded) {
      console.warn("[Login] signed-in but NOT onboarded → redirecting to /start");
      navigate("/start", { replace: true });
    }
  }, [navigate]);

  const submit = (e) => {
    e.preventDefault();
    if (!email) {
      Analytics.event("login_submit_empty_email");
      return;
    }

    Analytics.event("login_submit_attempt", { email });

    Auth.signIn(email);
    const done = Onboarding.isDone(email);
    console.log("[Login] signed-in:", email, "onboarded?", done);

    Analytics.event("login_submit_success", {
      email,
      onboarded: done,
    });

    navigate(done ? "/dashboard" : "/start", { replace: true });
  };

  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <SiteHeader />
      <main className="mx-auto max-w-container px-6 py-16">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="mt-2 text-rl_muted">
          Use your work email to access your campaign page.
        </p>
        <form onSubmit={submit} className="mt-8 max-w-sm space-y-4">
          <label className="block text-xs font-medium uppercase tracking-[0.2em] text-rl_muted">
            Work email
          </label>
          <input
            type="email"
            value={email}
            placeholder="you@brand.com"
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-rl_border bg-rl_accentSoft/40 px-3 py-2 text-sm outline-none focus:border-black focus:bg-white"
          />
          <button
            type="submit"
            className="mt-2 w-full rounded-full bg-black py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-zinc-900"
          >
            Sign in
          </button>
        </form>
      </main>
    </div>
  );
}
