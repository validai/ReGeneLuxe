import {
  CONNECTION_HINTS,
  MANUAL_UNSUPPORTED_HINT,
  providerPresentation,
  socialPresentation,
} from "./statusContracts.js";

export { CONNECTION_HINTS };

export function formatHandle(handle) {
  const raw = String(handle || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return raw.startsWith("@") ? raw : `@${raw.replace(/^@+/, "")}`;
}

function withErrorHint(view, connection) {
  const errorHint = connection?.lastErrorSummary || "";
  if (!errorHint || view.code === "CONNECTED" || view.code === "NOT_CONNECTED" || view.code === "UNKNOWN") {
    return view;
  }
  return { ...view, hint: errorHint };
}

const READINESS_PLACEHOLDERS = new Set(["", "MANUAL_ONLY", "UNCONNECTED", "NOT_CONNECTED"]);

export function displayConnectionState(account, { providerReadiness = "" } = {}) {
  const state = account?.connectionState || "";
  if (state === "CONNECTED") return socialPresentation("CONNECTED");
  if (state === "CONNECTING") return socialPresentation("CONNECTING");
  if (state === "RECONNECT_REQUIRED" || state === "AUTH_EXPIRED") return socialPresentation(state);
  if (state === "ERROR") return socialPresentation("ERROR");

  const placeholder = READINESS_PLACEHOLDERS.has(state);
  if (state === "MANUAL_ONLY" && providerReadiness === "UNSUPPORTED") {
    return { ...socialPresentation("MANUAL_ONLY"), hint: MANUAL_UNSUPPORTED_HINT };
  }
  if (state === "UNSUPPORTED" || (placeholder && providerReadiness === "UNSUPPORTED")) {
    return socialPresentation("UNSUPPORTED");
  }
  if (state === "PROVIDER_REVIEW_REQUIRED" || (placeholder && providerReadiness === "PROVIDER_REVIEW_REQUIRED")) {
    return socialPresentation("PROVIDER_REVIEW_REQUIRED");
  }
  if (state === "SETUP_REQUIRED" || (placeholder && providerReadiness === "SETUP_REQUIRED")) {
    return socialPresentation("SETUP_REQUIRED");
  }
  if (state === "UNCONNECTED" || state === "NOT_CONNECTED") return socialPresentation(state);
  if (!state) return socialPresentation("MANUAL_ONLY");
  return socialPresentation(state);
}

export function displayProfileConnection(connection) {
  const status = connection?.status || connection?.connectionState || "";
  if (!status) return providerPresentation("NOT_CONNECTED");
  if (status === "AUTH_EXPIRED") {
    return withErrorHint(providerPresentation("RECONNECT_REQUIRED"), connection);
  }
  return withErrorHint(providerPresentation(status), connection);
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
