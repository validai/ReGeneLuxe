// FILE: src/App.jsx
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import HomePage from "./pages/HomePage.jsx";
import Gate from "./pages/Gate.jsx";
import Start from "./pages/Start.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewCampaign from "./pages/NewCampaign.jsx";
import DraftingRoom from "./pages/DraftingRoom.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import NotFound from "./pages/NotFound.jsx";

// Central auth/onboarding utilities
import { Auth } from "./utils/auth.js";
import { Onboarding } from "./utils/onboarding.js";

// Route guard component
function RouteGuard({ children }) {
  const location = useLocation();
  const path = location.pathname;
  
  const user = Auth.isSignedIn() ? { email: Auth.user() } : null;
  const protectedRoutes = ["/dashboard", "/campaign/new", "/drafting-room", "/thank-you"];
  
  // State A — Signed Out
  if (!user) {
    if (protectedRoutes.includes(path)) {
      return <Navigate to="/" replace />;
    }
    return children;
  }
  
  // State B — Signed In, NOT Onboarded
  if (user && !Onboarding.isDone(user.email)) {
    // Allow /dashboard access - Dashboard will handle redirect if needed
    if (path !== "/start" && path !== "/dashboard") {
      return <Navigate to="/start" replace />;
    }
    return children;
  }
  
  // State C — Signed In, Onboarded
  if (user && Onboarding.isDone(user.email)) {
    if (path === "/login" || path === "/start" || path === "/") {
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  }
  
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RouteGuard><HomePage /></RouteGuard>} />
      <Route path="/gate" element={<Gate />} />
      <Route path="/login" element={<RouteGuard><Login /></RouteGuard>} />
      <Route path="/start" element={<RouteGuard><Start /></RouteGuard>} />
      <Route path="/dashboard" element={<RouteGuard><Dashboard /></RouteGuard>} />
      <Route path="/campaign/new" element={<RouteGuard><NewCampaign /></RouteGuard>} />
      <Route path="/drafting-room" element={<RouteGuard><DraftingRoom /></RouteGuard>} />
      <Route path="/thank-you" element={<RouteGuard><ThankYou /></RouteGuard>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}