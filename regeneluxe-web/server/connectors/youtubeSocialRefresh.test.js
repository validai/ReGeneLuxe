import { mkdtempSync, readFileSync } from "node:fs";
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

  it("does not refresh a valid access token", async () => {
    setAccountTokens("youtube", "acc_yt_valid", {
      accessToken: "still-valid",
      refreshToken: "stored-refresh",
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
      providerAccountId: "UC123",
    });
    fetch.mockResolvedValue(jsonResponse(200, {
      items: [{ id: "UC123", snippet: { title: "Coast Ent", customUrl: "@_djcoast" }, statistics: {} }],
    }));
    const profile = await youtubeConnector.getProfile({ id: "acc_yt_valid" });
    expect(profile.ok).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0][0])).toContain("/youtube/v3/channels");
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer still-valid");
    expect(getAccountTokens("youtube", "acc_yt_valid").refreshToken).toBe("stored-refresh");
  });

  it("keeps the stored refresh token when Google omits a new one and replaces it when Google rotates", async () => {
    setAccountTokens("youtube", "acc_yt_rotate", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly", "https://www.googleapis.com/auth/youtube.upload"],
      providerAccountId: "UC123",
    });
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        return jsonResponse(200, {
          access_token: "rotated-access",
          refresh_token: "rotated-refresh",
          expires_in: 3600,
          scope: "https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
        });
      }
      return jsonResponse(200, {
        items: [{ id: "UC123", snippet: { title: "Coast Ent", customUrl: "@_djcoast" }, statistics: {} }],
      });
    });
    const profile = await youtubeConnector.getProfile({ id: "acc_yt_rotate" });
    expect(profile.ok).toBe(true);
    expect(profile.profile.handle).toBe("@_djcoast");
    const stored = getAccountTokens("youtube", "acc_yt_rotate");
    expect(stored.accessToken).toBe("rotated-access");
    expect(stored.refreshToken).toBe("rotated-refresh");
    expect(stored.scopes).toEqual([
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube.upload",
    ]);
    const vault = readFileSync(process.env.RL_SECRETS_PATH, "utf8");
    expect(vault).not.toContain("rotated-access");
    expect(vault).not.toContain("rotated-refresh");
    expect(vault).not.toContain("google-secret");
    expect(JSON.stringify(profile)).not.toMatch(/rotated-access|rotated-refresh|google-secret/);
  });

  it("keeps the previous credential when refresh fails", async () => {
    setAccountTokens("youtube", "acc_yt_keep", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
      providerAccountId: "UC123",
    });
    fetch.mockResolvedValue(jsonResponse(400, { error: "invalid_grant", error_description: "stored-refresh" }));
    const profile = await youtubeConnector.getProfile({ id: "acc_yt_keep" });
    expect(profile.ok).toBe(false);
    expect(JSON.stringify(profile)).not.toMatch(/stored-refresh|expired-access|google-secret/);
    const stored = getAccountTokens("youtube", "acc_yt_keep");
    expect(stored.accessToken).toBe("expired-access");
    expect(stored.refreshToken).toBe("stored-refresh");
    expect(stored.scopes).toEqual(["https://www.googleapis.com/auth/youtube.readonly"]);
  });

  it("coalesces concurrent refreshes for the same account", async () => {
    setAccountTokens("youtube", "acc_yt_race", {
      accessToken: "expired-access",
      refreshToken: "stored-refresh",
      expiresAt: "2020-01-01T00:00:00.000Z",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
      providerAccountId: "UC123",
    });
    let tokenCalls = 0;
    fetch.mockImplementation(async (url) => {
      if (String(url).includes("oauth2.googleapis.com/token")) {
        tokenCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return jsonResponse(200, { access_token: "fresh-access", expires_in: 3600 });
      }
      return jsonResponse(200, {
        items: [{ id: "UC123", snippet: { title: "Coast Ent", customUrl: "@_djcoast" }, statistics: {} }],
      });
    });
    const [first, second] = await Promise.all([
      youtubeConnector.getProfile({ id: "acc_yt_race" }),
      youtubeConnector.getProfile({ id: "acc_yt_race" }),
    ]);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(tokenCalls).toBe(1);
    expect(getAccountTokens("youtube", "acc_yt_race").accessToken).toBe("fresh-access");
    expect(getAccountTokens("youtube", "acc_yt_race").refreshToken).toBe("stored-refresh");
  });
});
