// regeneluxe-web/src/components/SiteHeader.jsx
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Auth } from "../utils/auth";

export default function SiteHeader() {
  const nav = useNavigate();
  const loc = useLocation();
  const authed = Auth.isSignedIn();
  const [showCTA, setShowCTA] = useState(true);

  // ✅ Hide header on the Start (landing) page only
  if (loc.pathname === "/") return null;

  useEffect(() => {
    const hero = document.getElementById("hero-top");
    const onScroll = () => setShowCTA(window.scrollY > 160);

    if (!hero) {
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }

    const io = new IntersectionObserver(
      (entries) => setShowCTA(!entries[0].isIntersecting),
      { rootMargin: "0px 0px 0px 0px", threshold: 0.01 }
    );

    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-rl_border bg-rl_bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-container items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-gradient-to-br from-black to-gray-500" />
          <span className="text-xs font-medium tracking-[0.24em] uppercase">
            ReGeneLuxe
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {authed ? (
            <>
              {loc.pathname !== "/dashboard" && (
                <Link
                  to="/dashboard"
                  className="rounded-full border border-rl_border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] hover:bg-subtle transition-colors"
                >
                  Dashboard
                </Link>
              )}
              <button
                onClick={() => {
                  Auth.signOut();
                  nav("/");
                }}
                className="rounded-full bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white hover:bg-zinc-900 transition-colors"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              {loc.pathname !== "/get-started" && (
                <Link
                  to="/get-started"
                  className={`rounded-full border border-rl_border px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] hover:bg-subtle transition-colors ${
                    showCTA ? "opacity-100" : "opacity-0 pointer-events-none"
                  }`}
                >
                  Get started
                </Link>
              )}
              {loc.pathname !== "/login" && (
                <Link
                  to="/login"
                  className="rounded-full bg-black px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white hover:bg-zinc-900 transition-colors"
                >
                  Sign in
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

