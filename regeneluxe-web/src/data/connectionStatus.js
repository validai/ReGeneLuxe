import { CONNECTION_LABELS } from "./domain.js";

export const CONNECTION_HINTS = {
  CONNECTED: "Authenticated with the provider.",
  MANUAL_ONLY: "Not authenticated",
  UNCONNECTED: "Not authenticated",
  SETUP_REQUIRED: "Provider configuration is required before connecting.",
  RECONNECT_REQUIRED: "Provider auth expired or was revoked.",
  AUTH_EXPIRED: "Provider auth expired or was revoked.",
  PROVIDER_REVIEW_REQUIRED: "Integration exists but provider approval blocks activation.",
  UNSUPPORTED: "Not connected",
  MANUAL_UNSUPPORTED: "Manual account available. No authenticated connector yet.",
  CONNECTING: "Authorization in progress.",
  ERROR: "Provider auth expired or was revoked.",
};

export function formatHandle(handle) {
  const raw = String(handle || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("@") ? raw : `@${raw.replace(/^@+/, "")}`;
}

export function displayConnectionState(account, { providerReadiness = "" } = {}) {
  const state = account?.connectionState || "MANUAL_ONLY";
  if (state === "CONNECTED") {
    return {
      code: "CONNECTED",
      label: CONNECTION_LABELS.CONNECTED,
      hint: CONNECTION_HINTS.CONNECTED,
    };
  }
  if (state === "CONNECTING") {
    return {
      code: "CONNECTING",
      label: CONNECTION_LABELS.CONNECTING,
      hint: CONNECTION_HINTS.CONNECTING,
    };
  }
  if (state === "RECONNECT_REQUIRED" || state === "AUTH_EXPIRED" || state === "ERROR") {
    return {
      code: "RECONNECT_REQUIRED",
      label: CONNECTION_LABELS.RECONNECT_REQUIRED,
      hint: CONNECTION_HINTS.RECONNECT_REQUIRED,
    };
  }
  const unsupportedConnector = state === "UNSUPPORTED" || providerReadiness === "UNSUPPORTED";
  if (unsupportedConnector && state === "MANUAL_ONLY") {
    return {
      code: "MANUAL_ONLY",
      label: CONNECTION_LABELS.MANUAL_ONLY,
      hint: CONNECTION_HINTS.MANUAL_UNSUPPORTED,
    };
  }
  if (unsupportedConnector) {
    return {
      code: "UNSUPPORTED",
      label: CONNECTION_LABELS.UNSUPPORTED,
      hint: CONNECTION_HINTS.UNSUPPORTED,
    };
  }
  if (state === "PROVIDER_REVIEW_REQUIRED" || providerReadiness === "PROVIDER_REVIEW_REQUIRED") {
    return {
      code: "PROVIDER_REVIEW_REQUIRED",
      label: CONNECTION_LABELS.PROVIDER_REVIEW_REQUIRED,
      hint: CONNECTION_HINTS.PROVIDER_REVIEW_REQUIRED,
    };
  }
  if (state === "SETUP_REQUIRED" || providerReadiness === "SETUP_REQUIRED") {
    return {
      code: "SETUP_REQUIRED",
      label: CONNECTION_LABELS.SETUP_REQUIRED,
      hint: CONNECTION_HINTS.SETUP_REQUIRED,
    };
  }
  if (state === "UNCONNECTED") {
    return {
      code: "UNCONNECTED",
      label: CONNECTION_LABELS.UNCONNECTED,
      hint: CONNECTION_HINTS.UNCONNECTED,
    };
  }
  return {
    code: "MANUAL_ONLY",
    label: CONNECTION_LABELS.MANUAL_ONLY,
    hint: CONNECTION_HINTS.MANUAL_ONLY,
  };
}

export function displayProfileConnection(connection) {
  const status = connection?.status || connection?.connectionState || "NOT_CONNECTED";
  if (status === "CONNECTED") {
    return {
      code: "CONNECTED",
      label: CONNECTION_LABELS.CONNECTED,
      hint: CONNECTION_HINTS.CONNECTED,
    };
  }
  if (status === "RECONNECT_REQUIRED" || status === "AUTH_EXPIRED") {
    return {
      code: "RECONNECT_REQUIRED",
      label: CONNECTION_LABELS.RECONNECT_REQUIRED,
      hint: CONNECTION_HINTS.RECONNECT_REQUIRED,
    };
  }
  if (status === "ERROR") {
    return {
      code: "ERROR",
      label: CONNECTION_LABELS.ERROR,
      hint: CONNECTION_HINTS.ERROR,
    };
  }
  return {
    code: "NOT_CONNECTED",
    label: CONNECTION_LABELS.NOT_CONNECTED || CONNECTION_LABELS.UNCONNECTED,
    hint: "Mailbox access is not requested at sign-in.",
  };
}

export function socialAccountFilterLabel(account, options = {}) {
  if (!account) return "All social accounts";
  const handle = formatHandle(account.handle) || account.displayName || "Untitled";
  const state = displayConnectionState(account, options);
  return `${account.platform} ${handle} · ${state.label}`;
}

export function urlDetectionDoesNotConnect(parsed) {
  if (!parsed?.ok) return true;
  return parsed.connectionState !== "CONNECTED";
}
