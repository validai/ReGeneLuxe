import React from "react";
import ErrorState from "./app/ErrorState.jsx";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-rl_bg px-4 text-rl_text">
          <div className="w-full max-w-lg">
            <ErrorState
              title="The page encountered an error."
              body="Something broke while rendering. Refresh to continue."
              details={this.state.error?.message || String(this.state.error || "")}
              action={(
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="rl-btn"
                >
                  Refresh page
                </button>
              )}
            />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
