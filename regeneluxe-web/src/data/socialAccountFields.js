import { PLATFORMS } from "./models.js";

/** User-facing identity hints. Identifier normalization only — never implies CONNECTED. */
export const PLATFORM_IDENTITY_HINTS = {
  Instagram: "Instagram profile URL or @handle",
  Facebook: "Facebook Page URL or page username",
  YouTube: "YouTube channel URL, @handle, or channel ID (UC…)",
  TikTok: "TikTok profile URL or @handle",
  X: "X profile URL or @handle",
  Threads: "Threads profile URL or @handle",
  SoundCloud: "SoundCloud profile URL or username",
  Snapchat: "Snapchat profile URL or username",
  Twitch: "Twitch channel URL or username",
  Kick: "Kick channel URL or username",
  LinkedIn: "LinkedIn profile, company, or page URL",
  Other: "Display name plus a URL and/or handle",
};

export function identityHintForPlatform(platform) {
  return PLATFORM_IDENTITY_HINTS[platform] || PLATFORM_IDENTITY_HINTS.Other;
}

/**
 * Which composer fields to show for a platform.
 * Connection status, providerAccountId, tokens, and workspace id are never editable here.
 */
export function fieldsForPlatform(platform) {
  if (platform === "Other") {
    return {
      identity: false,
      displayName: true,
      handle: true,
      profileUrl: true,
      note: "",
    };
  }
  if (platform === "LinkedIn") {
    return {
      identity: true,
      displayName: true,
      handle: false,
      profileUrl: false,
      note: "LinkedIn stays Unsupported until a real connector exists. A URL does not connect it.",
    };
  }
  if (platform === "YouTube") {
    return {
      identity: true,
      displayName: true,
      handle: false,
      profileUrl: false,
      note: "Accepts a channel URL, @handle, or channel ID. This does not connect YouTube.",
    };
  }
  return {
    identity: true,
    displayName: true,
    handle: false,
    profileUrl: false,
    note: "",
  };
}

export function composerPlatforms() {
  return PLATFORMS;
}
