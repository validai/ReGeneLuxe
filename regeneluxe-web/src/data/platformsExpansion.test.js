import { describe, expect, it } from "vitest";
import { PLATFORMS, PLATFORM_IDS, SOCIAL_CONNECTION_PLATFORMS, emptyAccount } from "./models.js";
import { emptyManagedProfile } from "./profileModels.js";
import { PlatformSchema } from "./schemas.ts";
import { parseSocialIdentity } from "./socialAccountUrl.js";
import { socialAccountFilterLabel, urlDetectionDoesNotConnect } from "./connectionStatus.js";
import { accountOptionLabel } from "./workingContext.js";

describe("platform list expansion", () => {
  it("adds Snapchat, Twitch, and Kick as canonical display names", () => {
    expect(PLATFORMS).toEqual(expect.arrayContaining(["Snapchat", "Twitch", "Kick"]));
    expect(PLATFORM_IDS.Snapchat).toBe("snapchat");
    expect(PLATFORM_IDS.Twitch).toBe("twitch");
    expect(PLATFORM_IDS.Kick).toBe("kick");
    expect(new Set(PLATFORMS).size).toBe(PLATFORMS.length);
  });

  it("includes the new platforms in profile and connection option lists", () => {
    expect(SOCIAL_CONNECTION_PLATFORMS).toEqual(expect.arrayContaining(["Snapchat", "Twitch", "Kick"]));
    expect(SOCIAL_CONNECTION_PLATFORMS).not.toContain("YouTube");
    expect(SOCIAL_CONNECTION_PLATFORMS).not.toContain("Other");
    for (const platform of ["Snapchat", "Twitch", "Kick"]) {
      expect(PlatformSchema.parse(platform)).toBe(platform);
    }
  });

  it("persists selected profile platforms without dropping existing ones", () => {
    const profile = emptyManagedProfile({
      displayName: "DJ Coast",
      platforms: ["YouTube", "Snapchat", "Twitch", "Kick"],
    });
    expect(profile.platforms).toEqual(["YouTube", "Snapchat", "Twitch", "Kick"]);
    const legacy = emptyManagedProfile({
      displayName: "DJ Coast",
      platforms: ["YouTube", "Instagram"],
    });
    expect(legacy.platforms).toEqual(["YouTube", "Instagram"]);
  });

  it("creates manual accounts that stay MANUAL_ONLY", () => {
    for (const platform of ["Snapchat", "Twitch", "Kick"]) {
      const account = emptyAccount({
        platform,
        displayName: "DJ Coast",
        handle: "@djcoast",
        profileUrl: parseSocialIdentity(
          platform === "Snapchat"
            ? "https://www.snapchat.com/add/djcoast"
            : platform === "Twitch"
              ? "https://www.twitch.tv/djcoast"
              : "https://kick.com/djcoast",
        ).profileUrl,
      });
      expect(account.platform).toBe(platform);
      expect(account.connectionState).toBe("MANUAL_ONLY");
      expect(account.connectionState).not.toBe("CONNECTED");
      expect(accountOptionLabel(account)).toBe(`${platform} @djcoast · Manual`);
      expect(socialAccountFilterLabel(account)).toBe(`${platform} @djcoast · Manual`);
    }
  });

  it("keeps URL detection as identity only", () => {
    const parsed = parseSocialIdentity("https://www.twitch.tv/djcoast");
    expect(parsed.ok).toBe(true);
    expect(urlDetectionDoesNotConnect(parsed)).toBe(true);
  });
});
