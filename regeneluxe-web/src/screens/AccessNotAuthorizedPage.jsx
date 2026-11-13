"use client";

import BrandTitle from "../components/BrandTitle.jsx";
import { chooseAnotherGoogleAccount } from "../../app/actions/auth";

const COPY = {
  invite_mismatch: {
    title: "Google account does not match",
    body: "This Google account does not match the profile invitation. Choose the Google account that was authorized for the new profile.",
  },
  not_allowlisted: {
    title: "Access not authorized",
    body: "This Google account is not approved for the ReGeneLuxe private pilot. Sign in with an approved Google account, or ask an existing operator to authorize Create Another Profile for your email.",
  },
  identity_mismatch: {
    title: "Access not authorized",
    body: "This Google account cannot be used for this ReGeneLuxe identity.",
  },
  default: {
    title: "Access not authorized",
    body: "This Google account is not approved for the ReGeneLuxe private pilot. Sign in with an approved Google account.",
  },
};

export default function AccessNotAuthorizedPage({ reason = "", createProfilePending = false } = {}) {
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
              {createProfilePending || reason === "invite_mismatch" ? (
                <input type="hidden" name="createProfile" value="1" />
              ) : null}
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
