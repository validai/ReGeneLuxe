"use client";

import { BrowserRouter } from "react-router-dom";
import App from "../src/App.jsx";
import ErrorBoundary from "../src/components/ErrorBoundary.jsx";

/**
 * Sprint 85–88 bridge: host the finished Vite SPA UI inside Next App Router
 * without a blank rewrite. Routes peel to native App Router in later sprints.
 */
export default function SpaBridge() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
