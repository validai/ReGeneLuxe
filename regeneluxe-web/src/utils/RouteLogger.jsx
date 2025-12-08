// FILE: src/utils/RouteLogger.jsx
import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "./analytics";

/**
 * RouteLogger:
 * - Mounts once inside the Router tree.
 * - On every location change, emits a page-view event.
 */
export default function RouteLogger() {
  const location = useLocation();

  useEffect(() => {
    try {
      const path =
        (location && location.pathname ? location.pathname : "") +
        (location && location.search ? location.search : "");
      if (!path) return;
      Analytics.page(path);
    } catch (e) {
      Analytics.error("route_logger_error", {
        message: e?.message,
        name: e?.name,
      });
    }
  }, [location]);

  return null;
}
