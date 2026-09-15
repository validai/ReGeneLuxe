/**
 * Canonical SocialConnector capability enum.
 * Client registry aliases map legacy names onto these.
 */

export const CAPABILITY = Object.freeze({
  READ_PROFILE: "READ_PROFILE",
  READ_CONTENT: "READ_CONTENT",
  READ_ACCOUNT_METRICS: "READ_ACCOUNT_METRICS",
  READ_CONTENT_METRICS: "READ_CONTENT_METRICS",
  READ_COMMENTS: "READ_COMMENTS",
  READ_MENTIONS: "READ_MENTIONS",
  READ_MESSAGES: "READ_MESSAGES",
  REPLY: "REPLY",
  PUBLISH_TEXT: "PUBLISH_TEXT",
  PUBLISH_IMAGE: "PUBLISH_IMAGE",
  PUBLISH_VIDEO: "PUBLISH_VIDEO",
  SCHEDULE: "SCHEDULE",
  DELETE_CONTENT: "DELETE_CONTENT",
});

/** Legacy → canonical aliases used by existing UI/tests. */
export const LEGACY_CAPABILITY_MAP = Object.freeze({
  READ_POSTS: CAPABILITY.READ_CONTENT,
  READ_POST_METRICS: CAPABILITY.READ_CONTENT_METRICS,
  CREATE_POST: CAPABILITY.PUBLISH_TEXT,
  PUBLISH_POST: CAPABILITY.PUBLISH_IMAGE,
  SCHEDULE_POST: CAPABILITY.SCHEDULE,
  DELETE_POST: CAPABILITY.DELETE_CONTENT,
});

export const PROVIDER_READINESS = Object.freeze({
  IMPLEMENTED: "IMPLEMENTED",
  SETUP_REQUIRED: "SETUP_REQUIRED",
  PROVIDER_REVIEW_REQUIRED: "PROVIDER_REVIEW_REQUIRED",
  UNSUPPORTED: "UNSUPPORTED",
});

export const CONNECTION_STATES = Object.freeze([
  "MANUAL_ONLY",
  "UNCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "AUTH_EXPIRED",
  "RECONNECT_REQUIRED",
  "ERROR",
  "UNSUPPORTED",
  "SETUP_REQUIRED",
]);

export function expandCapabilities(list = []) {
  const out = new Set();
  for (const raw of list) {
    const key = String(raw);
    out.add(key);
    if (LEGACY_CAPABILITY_MAP[key]) out.add(LEGACY_CAPABILITY_MAP[key]);
    // Bidirectional: if canonical present, also expose common legacy aliases for UI.
    for (const [legacy, canonical] of Object.entries(LEGACY_CAPABILITY_MAP)) {
      if (canonical === key) out.add(legacy);
    }
  }
  return [...out];
}

export function hasCapabilityIn(list, capability) {
  const expanded = expandCapabilities(list);
  const want = LEGACY_CAPABILITY_MAP[capability] || capability;
  return expanded.includes(capability) || expanded.includes(want);
}
