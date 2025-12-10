// FILE: src/components/ErrorBoundary.jsx
import React from "react";
import { Analytics } from "../utils/analytics";

/**
 * ErrorBoundary
 *
 * Catches React render/runtime errors in the subtree and:
 * - Logs them to Analytics (wrapped in try/catch to avoid cascading failures).
 * - Shows a simple full-screen error UI with a refresh button.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorId: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    const errorId =
      "rb_" +
      Math.random().toString(36).slice(2) +
      "_" +
      Date.now().toString(36);

    try {
      Analytics.error("react_error_boundary", {
        errorId,
        message: error?.message,
        name: error?.name,
        stack: error?.stack || null,
        componentStack: info?.componentStack || null,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary] Analytics error", e);
    }

    this.setState({ errorId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-rl_bg text-rl_text flex items-center justify-center">
          <div className="mx-4 max-w-lg rounded-2xl border border-rl_border bg-rl_surface px-8 py-10 text-center shadow-rl_soft/70">
            <p className="text-[0.7rem] font-medium uppercase tracking-[0.22em] text-rl_muted">
              Something went wrong
            </p>
            <h1 className="mt-3 text-2xl md:text-3xl font-semibold tracking-tight text-rl_text">
              The page encountered an error.
            </h1>
            <p className="mt-3 text-sm text-rl_muted">
              Our internal logger captured this issue. Try refreshing.
            </p>
            {this.state.errorId && (
              <p className="mt-4 text-[0.7rem] font-mono text-rl_muted">
                Error ID:{" "}
                <span className="font-semibold">{this.state.errorId}</span>
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
              className="mt-6 w-full inline-flex items-center justify-center rounded-full bg-rl_text px-6 py-2.5 text-xs md:text-sm font-medium uppercase tracking-[0.22em] text-rl_bg hover:bg-rl_accent hover:text-rl_bg transition"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ErrorBoundary.displayName = "ErrorBoundary";

export default ErrorBoundary;
