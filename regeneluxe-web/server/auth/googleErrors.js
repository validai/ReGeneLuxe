/** Operator-facing Google API errors. Never dump raw provider JSON. */

import { PROVIDER_CONNECTION_STATES } from "../../src/data/statusContracts.js";

export function googleApiDisabledMessage(service) {
  if (service === "gmail") {
    return "Gmail API needs to be enabled for the ReGeneLuxe Google Cloud project.";
  }
  if (service === "youtube-analytics") {
    return "YouTube Analytics API must be enabled before analytics can sync.";
  }
  return "YouTube Data API must be enabled before channel data can sync.";
}

export function googleRevokedMessage(service = "this account") {
  if (service === "Gmail" || service === "gmail") {
    return "Gmail access was revoked. Reconnect Gmail to continue syncing.";
  }
  return `Google authorization was revoked. Reconnect the ${service} account.`;
}

export function friendlyGoogleApiError(json, status, service = "google") {
  const message = String(
    json?.error?.message
    || json?.error_description
    || json?.error
    || "",
  );
  const reason = String(json?.error?.errors?.[0]?.reason || json?.error?.status || "");
  const blob = `${message} ${reason}`.toLowerCase();
  if (status === 429 || /rate.?limit|ratelimit|quota|userRateLimit/i.test(blob)) {
    return {
      code: "RATE_LIMITED",
      connectionState: PROVIDER_CONNECTION_STATES.ERROR,
      retryable: true,
      error: service === "gmail"
        ? "Gmail is temporarily unavailable. ReGeneLuxe will retry."
        : "YouTube is temporarily unavailable. ReGeneLuxe will retry.",
    };
  }
  if (status >= 500) {
    return {
      code: "UNAVAILABLE",
      connectionState: PROVIDER_CONNECTION_STATES.ERROR,
      retryable: true,
      error: service === "gmail"
        ? "Gmail is temporarily unavailable. ReGeneLuxe will retry."
        : "YouTube is temporarily unavailable. ReGeneLuxe will retry.",
    };
  }
  if (status === 401 || /invalid.?credentials|authError|unauthorized/i.test(blob)) {
    return {
      code: "REVOKED",
      connectionState: PROVIDER_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: googleRevokedMessage(service === "gmail" ? "Gmail" : service === "youtube" ? "YouTube" : "Google"),
    };
  }
  if (
    status === 403
    && /has not been used|disabled|accessNotConfigured|access_not_configured|api .+ not enabled|service.?disabled/i.test(blob)
  ) {
    const kind = service === "gmail"
      ? "gmail"
      : /analytics/i.test(blob)
        ? "youtube-analytics"
        : "youtube";
    return {
      code: "SETUP_REQUIRED",
      connectionState: PROVIDER_CONNECTION_STATES.SETUP_REQUIRED,
      error: googleApiDisabledMessage(kind),
    };
  }
  if (status === 403 && /insufficient.?permission|insufficientPermissions/i.test(blob)) {
    return {
      code: "RECONNECT_REQUIRED",
      connectionState: PROVIDER_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: googleRevokedMessage(service === "gmail" ? "Gmail" : "YouTube"),
    };
  }
  return {
    code: "ERROR",
    connectionState: status === 401 || status === 403
      ? PROVIDER_CONNECTION_STATES.RECONNECT_REQUIRED
      : PROVIDER_CONNECTION_STATES.ERROR,
    error: service === "gmail"
      ? "Gmail could not complete this request. Try again or reconnect."
      : "YouTube could not complete this request. Try again or reconnect.",
  };
}
