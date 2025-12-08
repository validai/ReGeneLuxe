// FILE: src/pages/NotFound.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import { Analytics } from "../utils/analytics";

export default function NotFound() {
  const navigate = useNavigate();

  React.useEffect(() => {
    Analytics.page("404_not_found");
  }, []);

  return (
    <div className="min-h-screen bg-page text-rl_ink flex items-center justify-center">
      <div className="mx-4 max-w-lg rounded-3xl border border-rl_border bg-white px-8 py-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rl_muted">
          Page not found
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          This route doesn&apos;t exist.
        </h1>
        <p className="mt-3 text-sm text-rl_muted">
          The link you followed may be broken, expired, or typed incorrectly.
        </p>

        <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={() => {
              Analytics.event("404_back_home");
              navigate("/");
            }}
            className="w-full rounded-full bg-black px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-zinc-900"
          >
            Back to Home
          </button>
          <button
            type="button"
            onClick={() => {
              Analytics.event("404_go_gate");
              navigate("/gate");
            }}
            className="w-full rounded-full border border-rl_border px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em]"
          >
            Learn about ReGeneLuxe
          </button>
        </div>
      </div>
    </div>
  );
}
