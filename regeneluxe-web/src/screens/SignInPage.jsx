"use client";

import BrandTitle from "../components/BrandTitle.jsx";
import { signInWithGoogle } from "../../app/actions/auth";

function GoogleMark() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
      <path fill="#FBBC05" d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707s.102-1.167.282-1.707V4.961H.957C.348 6.175 0 7.55 0 9s.348 2.825.957 4.039l3.007-2.332z" />
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
    </svg>
  );
}

export default function SignInPage({ errorMessage = "", signedOut = false }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-rl_bg px-4 text-rl_text">
      <div className="w-full max-w-md space-y-8 text-center">
        <div className="space-y-3">
          <BrandTitle variant="hero" />
          <p className="text-sm text-rl_muted">Your social campaign command center.</p>
        </div>

        <div className="rl-panel space-y-5 p-8 text-left">
          {signedOut ? (
            <div
              className="space-y-2 rounded-lg border border-rl_ok/40 bg-rl_ok/10 px-4 py-4"
              role="status"
            >
              <h1 className="font-display text-lg font-semibold tracking-tight text-rl_text">
                Signed out
              </h1>
              <p className="text-sm leading-6 text-rl_textSecondary">
                You have successfully signed out of ReGeneLuxe.
              </p>
              <p className="text-sm leading-6 text-rl_textSecondary">
                This workspace is no longer active in this browser.
              </p>
              <p className="text-sm leading-6 text-rl_textSecondary">
                Sign in to your ReGeneLuxe account to continue.
              </p>
            </div>
          ) : (
            <p className="text-center text-sm text-rl_textSecondary">
              Sign in to your ReGeneLuxe account.
            </p>
          )}
          {signedOut ? (
            <p className="text-center text-xs text-rl_muted">
              Use the Google account that owns this ReGeneLuxe workspace.
            </p>
          ) : null}
          {errorMessage && !signedOut ? (
            <p className="rounded-lg border border-rl_danger/30 bg-rl_danger/10 px-3 py-2 text-sm text-rl_danger" role="alert">
              {errorMessage}
            </p>
          ) : null}
          <form action={signInWithGoogle}>
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-rl_border bg-white px-4 py-3 text-sm font-semibold text-[#1f1f1f] shadow-sm transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rl_accent/50"
            >
              <GoogleMark />
              Continue with Google
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
