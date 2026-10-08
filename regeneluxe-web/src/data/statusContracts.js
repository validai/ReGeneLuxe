/**
 * Canonical connection-status contracts.
 *
 * Provider grants (Gmail, YouTube) and social accounts are separate domains.
 * Job state and database sync health are not defined here.
 * Presentation is data only — no React.
 */

export const PROVIDER_CONNECTION_STATES = Object.freeze({
  CONNECTED: "CONNECTED",
  NOT_CONNECTED: "NOT_CONNECTED",
  RECONNECT_REQUIRED: "RECONNECT_REQUIRED",
  SETUP_REQUIRED: "SETUP_REQUIRED",
  SYNCING: "SYNCING",
  ERROR: "ERROR",
});

export const SOCIAL_CONNECTION_STATES = Object.freeze({
  MANUAL_ONLY: "MANUAL_ONLY",
  UNCONNECTED: "UNCONNECTED",
  NOT_CONNECTED: "NOT_CONNECTED",
  CONNECTING: "CONNECTING",
  CONNECTED: "CONNECTED",
  AUTH_EXPIRED: "AUTH_EXPIRED",
  RECONNECT_REQUIRED: "RECONNECT_REQUIRED",
  ERROR: "ERROR",
  UNSUPPORTED: "UNSUPPORTED",
  SETUP_REQUIRED: "SETUP_REQUIRED",
  PROVIDER_REVIEW_REQUIRED: "PROVIDER_REVIEW_REQUIRED",
});

/** Ordered list accepted by social account factories. */
export const SOCIAL_CONNECTION_STATE_LIST = Object.freeze(Object.values(SOCIAL_CONNECTION_STATES));

const TONE_CLASS = Object.freeze({
  ok: "bg-rl_ok/15 text-rl_ok",
  info: "bg-rl_info/15 text-rl_info",
  warning: "bg-rl_warning/15 text-rl_warning",
  danger: "bg-rl_danger/15 text-rl_danger",
  muted: "bg-rl_surfaceSoft text-rl_muted",
});

export const PROVIDER_CONNECTION_PRESENTATION = Object.freeze({
  CONNECTED: {
    label: "Connected",
    tone: "ok",
    hint: "Authenticated with the provider.",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    tone: "warning",
    hint: "Not connected",
  },
  RECONNECT_REQUIRED: {
    label: "Reconnect required",
    tone: "warning",
    hint: "Provider auth expired or was revoked.",
  },
  SETUP_REQUIRED: {
    label: "Setup required",
    tone: "warning",
    hint: "Provider configuration is required before connecting.",
  },
  SYNCING: {
    label: "Syncing",
    tone: "info",
    hint: "Syncing Gmail…",
  },
  ERROR: {
    label: "Error",
    tone: "danger",
    hint: "The last provider operation failed.",
  },
});

export const SOCIAL_CONNECTION_PRESENTATION = Object.freeze({
  MANUAL_ONLY: {
    label: "Manual",
    tone: "muted",
    hint: "Not authenticated",
  },
  UNCONNECTED: {
    label: "Not connected",
    tone: "warning",
    hint: "Not authenticated",
  },
  NOT_CONNECTED: {
    label: "Not connected",
    tone: "warning",
    hint: "Not connected",
  },
  CONNECTING: {
    label: "Connecting",
    tone: "info",
    hint: "Authorization in progress.",
  },
  CONNECTED: {
    label: "Connected",
    tone: "ok",
    hint: "Authenticated with the provider.",
  },
  AUTH_EXPIRED: {
    label: "Reconnect required",
    tone: "warning",
    hint: "Provider auth expired or was revoked.",
  },
  RECONNECT_REQUIRED: {
    label: "Reconnect required",
    tone: "warning",
    hint: "Provider auth expired or was revoked.",
  },
  ERROR: {
    label: "Error",
    tone: "danger",
    hint: "The last provider operation failed.",
  },
  UNSUPPORTED: {
    label: "Unsupported",
    tone: "muted",
    hint: "Not connected",
  },
  SETUP_REQUIRED: {
    label: "Setup required",
    tone: "warning",
    hint: "Provider configuration is required before connecting.",
  },
  PROVIDER_REVIEW_REQUIRED: {
    label: "Provider review required",
    tone: "warning",
    hint: "Integration exists but provider approval blocks activation.",
  },
});

export const UNKNOWN_CONNECTION_STATUS = Object.freeze({
  code: "UNKNOWN",
  label: "Unknown",
  tone: "muted",
  hint: "Unrecognized status",
});

function present(table, code) {
  const meta = table[code];
  if (!meta) {
    return {
      ...UNKNOWN_CONNECTION_STATUS,
      toneClass: TONE_CLASS.muted,
    };
  }
  return {
    code,
    label: meta.label,
    tone: meta.tone,
    hint: meta.hint,
    toneClass: TONE_CLASS[meta.tone] || TONE_CLASS.muted,
  };
}

export function isProviderConnectionState(value) {
  return Object.prototype.hasOwnProperty.call(PROVIDER_CONNECTION_PRESENTATION, value);
}

export function isSocialConnectionState(value) {
  return Object.prototype.hasOwnProperty.call(SOCIAL_CONNECTION_PRESENTATION, value);
}

export function providerPresentation(state) {
  return present(PROVIDER_CONNECTION_PRESENTATION, state);
}

export function socialPresentation(state) {
  return present(SOCIAL_CONNECTION_PRESENTATION, state);
}

/** Badge tone for a known connection state. Empty when the value is not a connection state. */
export function toneClassForConnectionState(state) {
  if (isProviderConnectionState(state)) return providerPresentation(state).toneClass;
  if (isSocialConnectionState(state)) return socialPresentation(state).toneClass;
  return "";
}

export function labelForConnectionState(state) {
  if (!state) return SOCIAL_CONNECTION_PRESENTATION.MANUAL_ONLY.label;
  if (isProviderConnectionState(state)) return providerPresentation(state).label;
  if (isSocialConnectionState(state)) return socialPresentation(state).label;
  return UNKNOWN_CONNECTION_STATUS.label;
}

function labelsFrom(table) {
  return Object.fromEntries(Object.entries(table).map(([code, meta]) => [code, meta.label]));
}

/** Shared label lookup. Provider labels win where a code exists in both domains. */
export const CONNECTION_LABELS = Object.freeze({
  ...labelsFrom(SOCIAL_CONNECTION_PRESENTATION),
  ...labelsFrom(PROVIDER_CONNECTION_PRESENTATION),
});

export const MANUAL_UNSUPPORTED_HINT = "Manual account available. No authenticated connector yet.";

function hintsFrom(table) {
  return Object.fromEntries(Object.entries(table).map(([code, meta]) => [code, meta.hint]));
}

export const CONNECTION_HINTS = Object.freeze({
  ...hintsFrom(SOCIAL_CONNECTION_PRESENTATION),
  ...hintsFrom(PROVIDER_CONNECTION_PRESENTATION),
  MANUAL_UNSUPPORTED: MANUAL_UNSUPPORTED_HINT,
});

export const PROVIDER_CONNECTION_TRANSITIONS = Object.freeze({
  NOT_CONNECTED: ["CONNECTED"],
  CONNECTED: ["SYNCING", "RECONNECT_REQUIRED", "ERROR", "SETUP_REQUIRED"],
  SYNCING: ["CONNECTED", "ERROR", "RECONNECT_REQUIRED", "SETUP_REQUIRED"],
  ERROR: ["SYNCING", "CONNECTED", "RECONNECT_REQUIRED"],
  RECONNECT_REQUIRED: ["CONNECTED"],
  SETUP_REQUIRED: ["CONNECTED", "SYNCING", "ERROR"],
});
