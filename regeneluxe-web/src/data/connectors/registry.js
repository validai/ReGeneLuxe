import { CAPABILITIES } from "../domain.js";

const ALL_READ = [
  CAPABILITIES.READ_PROFILE,
  CAPABILITIES.READ_POSTS,
  CAPABILITIES.READ_POST_METRICS,
  CAPABILITIES.READ_ACCOUNT_METRICS,
];

function adapter(platform, capabilities, notes) {
  return {
    platform,
    capabilities,
    notes,
    supported: capabilities.length > 0,
    async execute() {
      return {
        ok: false,
        unavailable: true,
        reason: "Unavailable through current connection",
      };
    },
  };
}

export const CONNECTORS = {
  Instagram: adapter("Instagram", [
    ...ALL_READ,
    CAPABILITIES.READ_COMMENTS,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
    CAPABILITIES.SCHEDULE_POST,
  ], "Requires a future Instagram Graph connection."),
  Facebook: adapter("Facebook", [
    ...ALL_READ,
    CAPABILITIES.READ_COMMENTS,
    CAPABILITIES.READ_MESSAGES,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
    CAPABILITIES.SCHEDULE_POST,
  ], "Requires a future Facebook Page connection."),
  YouTube: adapter("YouTube", [
    ...ALL_READ,
    CAPABILITIES.READ_COMMENTS,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
  ], "Requires a future YouTube Data connection."),
  TikTok: adapter("TikTok", [
    ...ALL_READ,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
  ], "Requires a future TikTok connection."),
  X: adapter("X", [
    ...ALL_READ,
    CAPABILITIES.READ_COMMENTS,
    CAPABILITIES.READ_MESSAGES,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
  ], "Requires a future X connection."),
  Threads: adapter("Threads", [
    CAPABILITIES.READ_PROFILE,
    CAPABILITIES.READ_POSTS,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
  ], "Requires a future Threads connection."),
  SoundCloud: adapter("SoundCloud", [
    CAPABILITIES.READ_PROFILE,
    CAPABILITIES.READ_POSTS,
    CAPABILITIES.READ_POST_METRICS,
  ], "Requires a future SoundCloud connection."),
  LinkedIn: adapter("LinkedIn", [
    CAPABILITIES.READ_PROFILE,
    CAPABILITIES.CREATE_POST,
    CAPABILITIES.PUBLISH_POST,
  ], "Requires a future LinkedIn connection."),
  Other: adapter("Other", [], "No provider adapter for this platform."),
};

export function getConnector(platform) {
  return CONNECTORS[platform] || CONNECTORS.Other;
}

export function declaredCapabilities(platform) {
  return [...(getConnector(platform).capabilities || [])];
}

export function availableCapabilities(account) {
  if (!account || account.connectionState !== "CONNECTED") return [];
  return declaredCapabilities(account.platform);
}

export function hasCapability(account, capability) {
  return availableCapabilities(account).includes(capability);
}

export function connectionLabel(account) {
  if (!account) return "Manual";
  if (account.connectionState === "CONNECTED") return "Connected";
  if (account.connectionState === "MANUAL_ONLY" || !account.connectionState) return "Manual";
  return account.connectionState.replaceAll("_", " ").toLowerCase();
}
