import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-social-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-social-key-")), "key");
process.env.RL_DB_MODE = "memory";
process.env.AUTH_GOOGLE_ID = "google-client";
process.env.AUTH_GOOGLE_SECRET = "google-secret";
process.env.AUTH_URL = "http://localhost:5174";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { getAccountTokens, setAccountTokens } = await import("../secrets/providers.js");
const { youtubeConnector } = await import("./providers/youtube.js");

function jsonResponse(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => headers[String(name).toLowerCase()] || null },
    json: async () => body,
  };
}

describe("youtube social token refresh", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("refreshes an expired access token before reading the channel", async () => {
    setAccountTokens("youtube", "acc_yt", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
      providerAccountId: "UC123",
    });
    fetch.mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, { access_token: "fresh-access", expires_in: 3600 });
      }
      return jsonResponse(200, {
        items: [{ id: "UC123", snippet: { title: "Coast Ent", customUrl: "@_djcoast" }, statistics: {} }],
      });
    });

    const profile = await youtubeConnector.getProfile({ id: "acc_yt" });
    expect(profile.ok).toBe(true);
    expect(profile.profile.providerAccountId).toBe("UC123");
    expect(String(fetch.mock.calls[0][0])).toContain("oauth2.googleapis.com/token");
    expect(String(fetch.mock.calls[1][0])).toContain("/youtube/v3/channels");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-access");
    const stored = getAccountTokens("youtube", "acc_yt");
    expect(stored.accessToken).toBe("fresh-access");
    expect(stored.refreshToken).toBe("stored-refresh");
    expect(stored.expiresAt > new Date().toISOString()).toBe(true);
  });

  it("does not call YouTube when refresh fails", async () => {
    setAccountTokens("youtube", "acc_yt_fail", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      providerAccountId: "UC123",
    });
    fetch.mockResolvedValue(jsonResponse(400, { error: "invalid_grant" }));
    const profile = await youtubeConnector.getProfile({ id: "acc_yt_fail" });
    expect(profile.ok).toBe(false);
    expect(profile.connectionState).toBe("RECONNECT_REQUIRED");
    expect(fetch.mock.calls.every((call) => String(call[0]).includes("oauth2.googleapis.com/token"))).toBe(true);
  });

  it("rejects a public upload before refreshing or uploading", async () => {
    setAccountTokens("youtube", "acc_yt_public", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      providerAccountId: "UC123",
    });
    const result = await youtubeConnector.publishContent(
      { id: "acc_yt_public" },
      { videoPath: "/tmp/pilot.mp4", privacyStatus: "public" },
    );
    expect(result.code).toBe("YOUTUBE_PILOT_PRIVATE_ONLY");
    expect(fetch).not.toHaveBeenCalled();
  });
});
