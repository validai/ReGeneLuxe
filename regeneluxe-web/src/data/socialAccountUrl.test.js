import { describe, expect, it } from "vitest";
import { parseSocialIdentity } from "./socialAccountUrl.js";
import { displayConnectionState, socialAccountFilterLabel, urlDetectionDoesNotConnect } from "./connectionStatus.js";

describe("social account URL parser", () => {
  it("normalizes Instagram URLs", () => {
    const parsed = parseSocialIdentity("https://www.instagram.com/djcoast/");
    expect(parsed.ok).toBe(true);
    expect(parsed.platform).toBe("Instagram");
    expect(parsed.handle).toBe("djcoast");
    expect(parsed.profileUrl).toBe("https://www.instagram.com/djcoast/");
    expect(parsed.connectionState).toBe("MANUAL_ONLY");
  });

  it("normalizes YouTube @channel URLs", () => {
    const parsed = parseSocialIdentity("youtube.com/@CoastEntertainment");
    expect(parsed.platform).toBe("YouTube");
    expect(parsed.handle).toBe("CoastEntertainment");
    expect(parsed.profileUrl).toBe("https://www.youtube.com/@CoastEntertainment");
  });

  it("normalizes X URLs", () => {
    const parsed = parseSocialIdentity("https://x.com/example");
    expect(parsed.platform).toBe("X");
    expect(parsed.handle).toBe("example");
    expect(parsed.profileUrl).toBe("https://x.com/example");
  });

  it("normalizes TikTok URLs", () => {
    const parsed = parseSocialIdentity("https://www.tiktok.com/@djcoast");
    expect(parsed.platform).toBe("TikTok");
    expect(parsed.handle).toBe("djcoast");
  });

  it("normalizes Facebook page URLs", () => {
    const parsed = parseSocialIdentity("https://www.facebook.com/CoastEntertainment");
    expect(parsed.platform).toBe("Facebook");
    expect(parsed.handle).toBe("CoastEntertainment");
  });

  it("normalizes Threads URLs", () => {
    const parsed = parseSocialIdentity("https://www.threads.net/@djcoast");
    expect(parsed.platform).toBe("Threads");
    expect(parsed.handle).toBe("djcoast");
  });

  it("normalizes SoundCloud URLs", () => {
    const parsed = parseSocialIdentity("https://soundcloud.com/djcoast");
    expect(parsed.platform).toBe("SoundCloud");
    expect(parsed.handle).toBe("djcoast");
  });

  it("normalizes Snapchat add URLs", () => {
    const www = parseSocialIdentity("https://www.snapchat.com/add/djcoast");
    expect(www.ok).toBe(true);
    expect(www.platform).toBe("Snapchat");
    expect(www.handle).toBe("djcoast");
    expect(www.profileUrl).toBe("https://www.snapchat.com/add/djcoast");
    expect(www.connectionState).toBe("MANUAL_ONLY");
    const bare = parseSocialIdentity("https://snapchat.com/add/djcoast");
    expect(bare.platform).toBe("Snapchat");
    expect(bare.handle).toBe("djcoast");
    expect(bare.profileUrl).toBe("https://www.snapchat.com/add/djcoast");
  });

  it("normalizes Twitch channel URLs", () => {
    const www = parseSocialIdentity("https://www.twitch.tv/djcoast");
    expect(www.ok).toBe(true);
    expect(www.platform).toBe("Twitch");
    expect(www.handle).toBe("djcoast");
    expect(www.profileUrl).toBe("https://www.twitch.tv/djcoast");
    expect(www.connectionState).toBe("MANUAL_ONLY");
    const bare = parseSocialIdentity("https://twitch.tv/djcoast");
    expect(bare.platform).toBe("Twitch");
    expect(bare.handle).toBe("djcoast");
  });

  it("normalizes Kick channel URLs", () => {
    const bare = parseSocialIdentity("https://kick.com/djcoast");
    expect(bare.ok).toBe(true);
    expect(bare.platform).toBe("Kick");
    expect(bare.handle).toBe("djcoast");
    expect(bare.profileUrl).toBe("https://kick.com/djcoast");
    expect(bare.connectionState).toBe("MANUAL_ONLY");
    const www = parseSocialIdentity("https://www.kick.com/djcoast");
    expect(www.platform).toBe("Kick");
    expect(www.handle).toBe("djcoast");
  });

  it("returns a manual-platform error for unknown URLs", () => {
    const parsed = parseSocialIdentity("https://example.com/someone");
    expect(parsed.ok).toBe(false);
    expect(parsed.error).toMatch(/couldn't identify the platform/i);
  });

  it("accepts a handle when the platform is chosen manually", () => {
    const parsed = parseSocialIdentity("@djcoast", { platform: "Instagram" });
    expect(parsed.ok).toBe(true);
    expect(parsed.handle).toBe("djcoast");
    expect(parsed.platform).toBe("Instagram");
    expect(parsed.detected).toBe(false);
  });

  it("never marks a parsed URL as CONNECTED", () => {
    const parsed = parseSocialIdentity("instagram.com/example");
    expect(urlDetectionDoesNotConnect(parsed)).toBe(true);
    expect(parsed.connectionState).not.toBe("CONNECTED");
  });

  it("never marks Snapchat, Twitch, or Kick URL detection as CONNECTED", () => {
    for (const url of [
      "https://www.snapchat.com/add/djcoast",
      "https://www.twitch.tv/djcoast",
      "https://kick.com/djcoast",
    ]) {
      const parsed = parseSocialIdentity(url);
      expect(urlDetectionDoesNotConnect(parsed)).toBe(true);
      expect(parsed.connectionState).toBe("MANUAL_ONLY");
      expect(parsed.connectionState).not.toBe("CONNECTED");
    }
  });
});

describe("connection state display", () => {
  it("labels a manual social account as Manual, not Connected", () => {
    const view = displayConnectionState({ platform: "Instagram", connectionState: "MANUAL_ONLY" });
    expect(view.label).toBe("Manual");
    expect(view.code).not.toBe("CONNECTED");
  });

  it("labels a connected social account as Connected", () => {
    expect(displayConnectionState({ connectionState: "CONNECTED" }).label).toBe("Connected");
  });

  it("surfaces setup-required from provider readiness without inventing Connected", () => {
    const view = displayConnectionState(
      { connectionState: "MANUAL_ONLY" },
      { providerReadiness: "SETUP_REQUIRED" },
    );
    expect(view.code).toBe("SETUP_REQUIRED");
    expect(view.label).toBe("Setup required");
  });

  it("does not let provider readiness override a live Connected account", () => {
    const view = displayConnectionState(
      { connectionState: "CONNECTED" },
      { providerReadiness: "SETUP_REQUIRED" },
    );
    expect(view.code).toBe("CONNECTED");
  });

  it("labels a manual unsupported account without inventing Connected", () => {
    const view = displayConnectionState(
      { platform: "Twitch", connectionState: "MANUAL_ONLY" },
      { providerReadiness: "UNSUPPORTED" },
    );
    expect(view.label).toBe("Manual");
    expect(view.code).toBe("MANUAL_ONLY");
    expect(view.code).not.toBe("CONNECTED");
    expect(view.hint).toMatch(/no authenticated connector yet/i);
  });

  it("labels the sidebar social-account filter with explicit state", () => {
    expect(socialAccountFilterLabel({
      platform: "Instagram",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
    })).toBe("Instagram @djcoast · Manual");
    expect(socialAccountFilterLabel({
      platform: "Instagram",
      handle: "djcoast",
      connectionState: "CONNECTED",
    })).toBe("Instagram @djcoast · Connected");
  });

  it("labels Snapchat, Twitch, and Kick in the social-account filter", () => {
    expect(socialAccountFilterLabel({
      platform: "Snapchat",
      handle: "djcoast",
      connectionState: "MANUAL_ONLY",
    }, { providerReadiness: "UNSUPPORTED" })).toBe("Snapchat @djcoast · Manual");
    expect(socialAccountFilterLabel({
      platform: "Twitch",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
    }, { providerReadiness: "UNSUPPORTED" })).toBe("Twitch @djcoast · Manual");
    expect(socialAccountFilterLabel({
      platform: "Kick",
      handle: "djcoast",
      connectionState: "MANUAL_ONLY",
    }, { providerReadiness: "UNSUPPORTED" })).toBe("Kick @djcoast · Manual");
  });
});
