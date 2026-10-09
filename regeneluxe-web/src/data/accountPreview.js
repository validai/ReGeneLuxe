/**
 * Account-screen fixtures for local development only.
 * Next inlines process.env.NODE_ENV, so production builds ignore preview URLs.
 */
/* eslint-disable no-undef */
const PREVIEW_MODES = new Set(["picker", "instagram", "destinations", "manual", "connected"]);

export function isAccountPreviewEnabled(nodeEnv = process.env.NODE_ENV) {
  return nodeEnv !== "production";
}

export function accountPreviewMode(value, nodeEnv = process.env.NODE_ENV) {
  if (!isAccountPreviewEnabled(nodeEnv)) return "";
  const mode = String(value || "");
  return PREVIEW_MODES.has(mode) ? mode : "";
}
/* eslint-enable no-undef */
