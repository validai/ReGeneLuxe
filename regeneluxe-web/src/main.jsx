// FILE: src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

import App from "./App.jsx";
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
        <RouteLogger />
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
