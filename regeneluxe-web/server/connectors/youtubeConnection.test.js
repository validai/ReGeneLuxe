import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { YOUTUBE_CONNECTION_SCOPE_STRING, OPERATOR_GOOGLE_SCOPES } from "../auth/googleScopes.js";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-key-")), "key");
process.env.RL_DB_MODE = "memory";
process.env.AUTH_GOOGLE_ID = "test-google-client";
process.env.AUTH_GOOGLE_SECRET = "test-google-secret";
process.env.AUTH_URL = "http://127.0.0.1:5174";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { consumeOAuthState } = await import("./oauth/state.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { initDb, resetDbForTests, closeDb, list, upsert, COLLECTIONS } = await import("../db/index.js");
const { createManagedProfile } = await import("../db/managedProfileRepository.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const {
  startYoutubeAuth,
  completeYoutubeAuth,
  selectYoutubeChannel,
  syncYoutubeChannel,
  disconnectYoutubeConnection,
  reconcileYoutubeAccount,
} = await import("./youtubeConnection.js");
const { publicProfileConnection } = await import("../../src/data/profileModels.js");
const { emptyAccount } = await import("../../src/data/models.js");

const COAST_CHANNEL_ID = "UCCoastEntTest1";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function channelItem(id, title, handle = "") {
  return {
    id,
    snippet: {
      title,
      customUrl: handle,
      thumbnails: { default: { url: `https://img.example/${id}.png` } },
    },
    statistics: { subscriberCount: "41", videoCount: "12", viewCount: "9001" },
  };
}

function mockYoutubeApis({
  channels = [channelItem(COAST_CHANNEL_ID, "Coast Entertainment", "@CoastEntertainment")],
  channelsStatus = 200,
  analyticsOk = true,
} = {}) {
  return vi.fn(async (url, init) => {
    const href = String(url);
    if (href.includes("oauth2.googleapis.com/token")) {
      return jsonResponse(200, {
        access_token: "yt-access",
        refresh_token: "yt-refresh",
        expires_in: 3600,
        scope: YOUTUBE_CONNECTION_SCOPE_STRING,
      });
    }
    if (href.includes("oauth2.googleapis.com/revoke")) return jsonResponse(200, {});
    if (href.includes("oauth2/v3/userinfo")) {
      return jsonResponse(200, { sub: "operator-sub", email: "djcoast239@gmail.com" });
    }
    if (href.includes("/youtube/v3/channels") && href.includes("mine=true")) {
      return jsonResponse(channelsStatus, channelsStatus >= 400
        ? { error: { message: "YouTube Data API has not been used in project 1 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }] } }
        : { items: channels });
    }
    if (href.includes("/youtube/v3/channels") && href.includes("id=")) {
      const id = decodeURIComponent(new URL(href).searchParams.get("id") || "");
      const match = channels.find((item) => item.id === id) || channels[0];
      return jsonResponse(200, { items: match ? [match] : [] });
    }
    if (href.includes("/youtube/v3/search")) {
      return jsonResponse(200, {
        items: [{ id: { videoId: "vid1" }, snippet: { title: "Live tonight", publishedAt: "2024-04-01T00:00:00Z" } }],
      });
    }
    if (href.includes("/youtube/v3/videos")) {
      return jsonResponse(200, {
        items: [{
          id: "vid1",
          snippet: { title: "Live tonight", publishedAt: "2024-04-01T00:00:00Z", thumbnails: { default: { url: "https://img.example/v.png" } } },
          statistics: { viewCount: "33", likeCount: "4", commentCount: "2" },
        }],
      });
    }
    if (href.includes("youtubeanalytics.googleapis.com")) {
      if (!analyticsOk) {
        return jsonResponse(403, { error: { message: "YouTube Analytics API has not been used in project 1 before or it is disabled." } });
      }
      return jsonResponse(200, {
        columnHeaders: [
          { name: "views" },
          { name: "estimatedMinutesWatched" },
          { name: "averageViewDuration" },
          { name: "subscribersGained" },
          { name: "subscribersLost" },
          { name: "likes" },
          { name: "comments" },
          { name: "shares" },
        ],
        rows: [[100, 12, 40, 2, 1, 8, 3, 1]],
      });
    }
    throw new Error(`unexpected fetch ${href} ${init?.method || ""}`);
  });
}

describe("youtube profile connection", () => {
  let operator;
  let profile;

  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    process.env.AUTH_GOOGLE_ID = "test-google-client";
    process.env.AUTH_GOOGLE_SECRET = "test-google-secret";
    await resetDbForTests();
    await initDb();
    operator = await upsertOperatorFromGoogle({
      googleSub: "operator-sub",
      email: "djcoast239@gmail.com",
      name: "Coast Ent",
    });
    profile = await createManagedProfile(operator.id, { displayName: "DJ Coast" });
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await closeDb();
  });

  it("starts readonly YouTube OAuth with login_hint for the signed-in account", async () => {
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    expect(started.ok).toBe(true);
    const url = new URL(started.authUrl);
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("login_hint")).toBe("djcoast239@gmail.com");
    expect(url.searchParams.get("scope")).toBe(YOUTUBE_CONNECTION_SCOPE_STRING);
    expect(url.searchParams.get("scope")).toContain("youtube.readonly");
    expect(url.searchParams.get("scope")).toContain("yt-analytics.readonly");
    expect(url.searchParams.get("scope")).not.toContain("youtube.upload");
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5174/api/oauth/youtube/callback");
    expect(OPERATOR_GOOGLE_SCOPES).not.toContain("youtube");
    const state = consumeOAuthState(started.state);
    expect(state.managedProfileId).toBe(profile.id);
    expect(state.operatorId).toBe(operator.id);
    expect(state.provider).toBe("youtube");
  });

  it("rejects callback state bound to a different operator", async () => {
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    const stranger = await upsertOperatorFromGoogle({
      googleSub: "stranger-sub",
      email: "other@example.com",
      name: "Other",
    });
    const result = await completeYoutubeAuth({ code: "auth-code", state: started.state, operator: stranger });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/account/i);
  });

  it("rejects a mismatched Google identity and does not attach YouTube", async () => {
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    const fetchMock = mockYoutubeApis();
    vi.stubGlobal("fetch", vi.fn(async (url, init) => {
      if (String(url).includes("oauth2/v3/userinfo")) {
        return jsonResponse(200, { sub: "other-sub", email: "other@gmail.com" });
      }
      return fetchMock(url, init);
    }));
    const result = await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("This Google account does not match the ReGeneLuxe account currently signed in.");
    expect(getAccountTokens("youtube", started.connectionId)?.accessToken).toBeFalsy();
  });

  it("auto-selects a single discovered channel and persists the provider channel id", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis());
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    const result = await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(true);
    expect(result.connection.channelId).toBe(COAST_CHANNEL_ID);
    expect(result.connection.channelTitle).toBe("Coast Entertainment");
    expect(result.connection.email).toBe("djcoast239@gmail.com");
    expect(result.redirectTo).toContain("youtube=connected");
    expect(JSON.stringify(result.connection)).not.toContain("yt-access");
    expect(getAccountTokens("youtube", started.connectionId).accessToken).toBe("yt-access");
    const videos = await list(COLLECTIONS.youtube_videos);
    expect(videos).toHaveLength(1);
    expect(videos[0].managedProfileId).toBe(profile.id);
    expect(videos[0].title).toBe("Live tonight");
    const snaps = await list(COLLECTIONS.analytics);
    expect(snaps.length).toBeGreaterThan(0);
    expect(snaps[0].metrics.views).toBe(100);
    expect(snaps[0].metrics.watchTimeSeconds).toBe(12 * 60);
    expect(snaps[0].id).not.toBe(snaps[1]?.id);
  });

  it("offers a channel picker when multiple channels are returned", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis({
      channels: [
        channelItem("UCother", "Other Channel", "@other"),
        channelItem(COAST_CHANNEL_ID, "Coast Entertainment", "@CoastEntertainment"),
      ],
    }));
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    const result = await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(true);
    expect(result.connection.pendingChannels).toHaveLength(2);
    expect(result.connection.channelId).toBe("");
    expect(result.redirectTo).toContain("youtube=pick");
    const selected = await selectYoutubeChannel({
      operator,
      activeProfile: profile,
      channelId: COAST_CHANNEL_ID,
    });
    expect(selected.ok).toBe(true);
    expect(selected.connection.channelId).toBe(COAST_CHANNEL_ID);
    expect(selected.connection.channelTitle).toBe("Coast Entertainment");
    expect(selected.connection.pendingChannels).toEqual([]);
  });

  it("surfaces SETUP REQUIRED when YouTube Data API is disabled", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis({ channelsStatus: 403 }));
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    const result = await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/YouTube Data API must be enabled/i);
  });

  it("stores null analytics values instead of invented zeros when Analytics API is unavailable", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis({ analyticsOk: false }));
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    const snaps = await list(COLLECTIONS.analytics);
    expect(snaps[0].metrics.views).toBe(9001);
    expect(snaps[0].metrics.watchTimeSeconds).toBeNull();
    expect(Object.values(snaps[0].metrics).includes(0)).toBe(false);
  });

  it("appends MetricSnapshots instead of overwriting history", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis());
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    const connection = (await list(COLLECTIONS.profile_connections)).find((row) => row.kind === "YOUTUBE");
    await syncYoutubeChannel({ connection });
    const snaps = await list(COLLECTIONS.analytics);
    expect(snaps.length).toBeGreaterThanOrEqual(2);
    expect(new Set(snaps.map((row) => row.id)).size).toBe(snaps.length);
  });

  it("reconciles a manual YouTube account by channel id, never display name", async () => {
    const existing = emptyAccount({
      platform: "YouTube",
      displayName: "Coast Entertainment",
      handle: "@someone-else",
      providerAccountId: COAST_CHANNEL_ID,
      managedProfileId: profile.id,
      connectionState: "MANUAL_ONLY",
    });
    const sameName = emptyAccount({
      platform: "YouTube",
      displayName: "Coast Entertainment",
      handle: "@different",
      providerAccountId: "UCdifferent",
      managedProfileId: profile.id,
      connectionState: "MANUAL_ONLY",
    });
    await upsert(COLLECTIONS.accounts, existing);
    await upsert(COLLECTIONS.accounts, sameName);
    await reconcileYoutubeAccount(profile, {
      id: COAST_CHANNEL_ID,
      title: "Coast Entertainment",
      handle: "@CoastEntertainment",
      profileUrl: `https://www.youtube.com/channel/${COAST_CHANNEL_ID}`,
      subscriberCount: 41,
    });
    const accounts = (await list(COLLECTIONS.accounts)).filter((row) => row.platform === "YouTube");
    expect(accounts).toHaveLength(2);
    const matched = accounts.find((row) => row.providerAccountId === COAST_CHANNEL_ID);
    expect(matched.id).toBe(existing.id);
    expect(matched.connectionState).toBe("CONNECTED");
    expect(accounts.find((row) => row.providerAccountId === "UCdifferent").id).toBe(sameName.id);
  });

  it("does not leak YouTube tokens onto public rows", () => {
    const publicRow = publicProfileConnection({
      kind: "YOUTUBE",
      status: "CONNECTED",
      accessToken: "nope",
      refreshToken: "nope2",
      channelId: COAST_CHANNEL_ID,
    });
    expect(publicRow.accessToken).toBeUndefined();
    expect(publicRow.refreshToken).toBeUndefined();
  });

  it("keeps YouTube data isolated to the authorizing profile", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis());
    const other = await createManagedProfile(operator.id, { displayName: "Other Act" });
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    const otherVideos = (await list(COLLECTIONS.youtube_videos)).filter((row) => row.managedProfileId === other.id);
    expect(otherVideos).toHaveLength(0);
    const otherConn = (await list(COLLECTIONS.profile_connections)).find((row) => (
      row.kind === "YOUTUBE" && row.managedProfileId === other.id
    ));
    expect(otherConn?.channelId || "").toBe("");
  });

  it("disconnects YouTube without deleting the managed profile", async () => {
    vi.stubGlobal("fetch", mockYoutubeApis());
    const started = await startYoutubeAuth({ operator, activeProfile: profile });
    await completeYoutubeAuth({ code: "auth-code", state: started.state, operator });
    const disconnected = await disconnectYoutubeConnection({ operator, activeProfile: profile });
    expect(disconnected.ok).toBe(true);
    expect(disconnected.profilePreserved).toBe(true);
    expect(getAccountTokens("youtube", started.connectionId)?.accessToken).toBeFalsy();
    const videos = await list(COLLECTIONS.youtube_videos);
    expect(videos.length).toBeGreaterThan(0);
  });
});
