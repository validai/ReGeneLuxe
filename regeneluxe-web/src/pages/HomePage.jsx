// FILE: src/pages/HomePage.jsx
import { useNavigate } from "react-router-dom";
import Showcase from "../components/Showcase";

export default function HomePage() {
  const nav = useNavigate();
  return (
    <div className="min-h-screen bg-page text-rl_ink">
      <main className="mx-auto max-w-container px-6 py-16">
        {/* Wordmark / welcome */}
        <section className="text-center">
          <h1
            aria-label="ReGeneLuxe"
            className="text-[clamp(2.4rem,8vw,4.25rem)] font-extrabold tracking-[0.14em] uppercase"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,1) 0%, rgba(90,90,90,1) 50%, rgba(0,0,0,1) 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              backgroundSize: "200% 100%",
            }}
          >
            ReGeneLuxe
          </h1>

        </section>

        {/* Path tiles */}
        <section className="mt-12 grid gap-6 md:grid-cols-2">
          <button
            onClick={() => {
              console.log("[Home] New here → /gate");
              nav("/gate");
            }}
            className="glass block rounded-3xl p-6 rl-hover-lift text-left"
          >
            <p className="text-[0.78rem] uppercase tracking-[0.16em] text-rl_muted">
              New here
            </p>
            <h2 className="mt-2 text-xl font-semibold">Start my first campaign</h2>
            <p className="mt-2 text-rl_muted">
              Answer a simple form. ReGeneLuxe assembles a complete starter
              campaign—on-brand and ready to launch.
            </p>
            <div className="mt-4 inline-flex rounded-full bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white">
              Get Started
            </div>
          </button>

          <button
            onClick={() => {
              console.log("[Home] Returning → /login");
              nav("/login");
            }}
            className="glass block rounded-3xl p-6 rl-hover-lift text-left"
          >
            <p className="text-[0.78rem] uppercase tracking-[0.16em] text-rl_muted">
              Returning
            </p>
            <h2 className="mt-2 text-xl font-semibold">I'm a member — Sign in</h2>
            <p className="mt-2 text-rl_muted">
              Open your campaign page, iterate with fresh variants, or start a
              new build in seconds.
            </p>
            <div className="mt-4 inline-flex rounded-full border border-rl_border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em]">
              Sign in
            </div>
          </button>
        </section>

        {/* Carousel */}
        <Showcase className="mt-16" />
      </main>
    </div>
  );
}
