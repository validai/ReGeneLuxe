"use client";

import BrandTitle from "../components/BrandTitle.jsx";

export default function AccessNotAuthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-rl_bg px-4 text-rl_text">
      <div className="w-full max-w-md space-y-8 text-center">
        <BrandTitle variant="hero" />
        <div className="rl-panel space-y-4 p-8 text-left">
          <h1 className="font-display text-xl font-semibold tracking-tight">Access not authorized</h1>
          <p className="text-sm leading-6 text-rl_muted">
            This Google account is not approved for the ReGeneLuxe private pilot.
            Sign in with an approved Google account.
          </p>
          <a href="/signin" className="rl-btn inline-flex">
            Back to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
