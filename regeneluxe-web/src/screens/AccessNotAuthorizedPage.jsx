"use client";

import BrandTitle from "../components/BrandTitle.jsx";
import { chooseAnotherGoogleAccount } from "../../app/actions/auth";

const COPY = {
  not_authorized: {
    title: "ReGeneLuxe access denied",
    body: "This Google account is not authorized for ReGeneLuxe access. Choose another Google account, or ask the ReGeneLuxe operator to grant application access.",
  },
  not_allowlisted: {
    title: "ReGeneLuxe access denied",
    body: "This Google account is not authorized for ReGeneLuxe access. Choose another Google account, or ask the ReGeneLuxe operator to grant application access.",
  },
  identity_mismatch: {
    title: "Access not authorized",
    body: "This Google account cannot be used for this ReGeneLuxe identity.",
  },
  default: {
    title: "ReGeneLuxe access denied",
    body: "This Google account is not authorized for ReGeneLuxe access.",
  },
};

export default function AccessNotAuthorizedPage({ reason = "" } = {}) {
  const copy = COPY[reason] || COPY.default;

  return (
    <div className="flex min-h-screen items-center justify-center bg-rl_bg px-4 text-rl_text">
      <div className="w-full max-w-md space-y-8 text-center">
        <BrandTitle variant="hero" />
        <div className="rl-panel space-y-4 p-8 text-left">
          <h1 className="font-display text-xl font-semibold tracking-tight">{copy.title}</h1>
          <p className="text-sm leading-6 text-rl_muted">{copy.body}</p>
          <div className="flex flex-wrap gap-2">
            <form action={chooseAnotherGoogleAccount}>
              <button type="submit" className="rl-btn px-3 py-2 text-sm">
                Choose another Google account
              </button>
            </form>
            <a href="/signin" className="rl-btn-ghost inline-flex px-3 py-2 text-sm">
              Back
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
