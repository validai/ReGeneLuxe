// FILE: src/components/layout/AppShell.jsx
import { useLocation } from "react-router-dom";
import SiteHeader from "../SiteHeader";
import AppFooter from "./AppFooter";

export default function AppShell({ children }) {
  const location = useLocation();
  const isEngineRoute = location.pathname.startsWith("/dashboard") || 
                        location.pathname === "/analytics" ||
                        location.pathname === "/audience" ||
                        location.pathname === "/settings";

  // ReGeneLuxe Engine routes have their own layout with SiteHeader
  if (isEngineRoute) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen flex flex-col bg-rl_bg text-rl_text">
      <SiteHeader />
      <main className="flex-1">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}

