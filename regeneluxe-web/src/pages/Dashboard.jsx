import React, { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Auth } from "../utils/auth";
import { Onboarding } from "../utils/onboarding";
import { Analytics } from "../utils/analytics";
import SiteHeader from "../components/SiteHeader";

export default function Dashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const authed = Auth.isSignedIn();
    const email = Auth.user();
    const onboarded = email ? Onboarding.isDone(email) : false;

    console.log("[Dashboard] guard check:", { authed, email, onboarded });

    if (!authed) {
      console.warn("[Dashboard] not signed in → redirecting to /login");
      navigate("/login", { replace: true });
      return;
    }

    if (!onboarded) {
      console.warn("[Dashboard] signed-in but NOT onboarded → redirecting to /start");
      navigate("/start", { replace: true });
    }
  }, [navigate]);

  const user = Auth.user();

  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <SiteHeader />
      <main className="mx-auto max-w-container px-6 py-12">
        <h1 className="text-2xl font-extrabold tracking-[-0.02em]">Your campaign page</h1>
        <p className="mt-2 text-rl_muted">
          Welcome{user ? `, ${user}` : ""}. Start a new campaign or review previous ones.
        </p>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <Link
            to="/campaign/new"
            onClick={() => {
              Analytics.event("dashboard_new_campaign_click");
            }}
            className="glass rounded-3xl p-6 block rl-hover-lift"
          >
            <p className="text-[0.78rem] tracking-[0.16em] uppercase text-rl_muted">Start</p>
            <h2 className="mt-2 text-xl font-semibold">New campaign</h2>
            <p className="mt-2 text-rl_muted">Open the campaign form to generate a fresh blueprint.</p>
          </Link>
          <div className="glass rounded-3xl p-6 rl-hover-lift">
            <p className="text-[0.78rem] tracking-[0.16em] uppercase text-rl_muted">History</p>
            <h2 className="mt-2 text-xl font-semibold">Your campaigns</h2>
            <p className="mt-2 text-rl_muted">Campaign list coming soon.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
