// FILE: src/components/ErrorBoundary.jsx
import React from "react";
import { Analytics } from "../utils/analytics";

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

    Analytics.error("react_error_boundary", {
      errorId,
      message: error?.message,
      name: error?.name,
      stack: error?.stack || null,
      componentStack: info?.componentStack || null,
    });

    this.setState({ errorId });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-page text-rl_ink flex items-center justify-center">
          <div className="mx-4 max-w-lg rounded-3xl border border-rl_border bg-white px-8 py-10 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-rl_muted">
              Something went wrong
            </p>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
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
              onClick={() => window.location.reload()}
              className="mt-6 w-full rounded-full bg-black px-6 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white hover:bg-zinc-900"
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

export default ErrorBoundary;
