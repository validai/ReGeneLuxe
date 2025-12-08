// FILE: src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import "./index.css";

import HomePage from "./pages/HomePage.jsx";
import Gate from "./pages/Gate.jsx";
import Start from "./pages/Start.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import NewCampaign from "./pages/NewCampaign.jsx";
import ThankYou from "./pages/ThankYou.jsx";
import NotFound from "./pages/NotFound.jsx";
import RouteLogger from "./utils/RouteLogger.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { Analytics } from "./utils/analytics";
import { installDevTools } from "./utils/devTools";

// Install global error handlers + dev tools before render (browser only)
if (typeof window !== "undefined") {
  Analytics.installGlobalErrorHandlers();
  installDevTools();
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        {/* Logs page views to Analytics on every location change */}
        <RouteLogger />

        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gate" element={<Gate />} />
          <Route path="/start" element={<Start />} />
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/campaign/new" element={<NewCampaign />} />
          <Route path="/thank-you" element={<ThankYou />} />
          {/* Fallback: any unknown path → NotFound */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
