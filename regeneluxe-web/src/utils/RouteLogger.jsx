// FILE: src/utils/RouteLogger.jsx
import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "./analytics";
import { EVENTS } from "./analyticsEvents";

const isBrowser = typeof window !== "undefined";
const isDev = typeof import.meta !== "undefined" && import.meta.env && import.meta.env.DEV;

/**
 * RouteLogger:
 * - Mounts once inside the Router tree.
 * - On every location change, emits a page-view event.
 * - Tracks current path, previous path, and document title.
 * - Skips logging in dev mode.
 */
export default function RouteLogger() {
  const location = useLocation();
  const lastPathRef = useRef(null);

  useEffect(() => {
    if (!isBrowser || isDev) return;

    const pathname = location?.pathname ?? "";
    const search = location?.search ?? "";
    const path = `${pathname}${search}`;

    if (!path || path === lastPathRef.current) return;

    const prevPath = lastPathRef.current;
    lastPathRef.current = path;

    try {
      Analytics.page(EVENTS.ROUTE_VIEW, {
        path,
        prevPath,
        title: typeof document !== "undefined" ? document.title : undefined,
      });
    } catch (err) {
      Analytics.error(EVENTS.FRONTEND_ERROR, {
        source: "route_logger",
        path,
        prevPath,
        message: err?.message,
        name: err?.name,
      });
    }
  }, [location?.pathname, location?.search]);

  return null;
}