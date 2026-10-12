import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-tw-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-tw-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { consumeOAuthState, peekOAuthState } = await import("./oauth/state.js");
const { twitchConnector } = await import("./providers/twitch.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult, failureFromAuth, findLikelyManualMatch } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["TWITCH_CLIENT_ID", "TWITCH_CLIENT_SECRET", "TWITCH_REDIRECT_URI", "AUTH_URL"];
const FORBIDDEN = /chat:read|chat:edit|channel:manage|clips:edit|bits:|moderator:|whispers:|channel:read:subscriptions/;

describe("twitch connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.TWITCH_CLIENT_ID;
    delete process.env.TWITCH_CLIENT_SECRET;
    delete process.env.TWITCH_REDIRECT_URI;
    await resetDbForTests();
    await initDb();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const key of ENV_KEYS) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  function configureTwitch() {
    process.env.TWITCH_CLIENT_ID = "twitch-client-id";
    process.env.TWITCH_CLIENT_SECRET = "twitch-client-secret";
  }

  function tokenPayload(extra = {}) {
    return {
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 14124,
      scope: [],
      token_type: "bearer",
      ...extra,
    };
  }

  function validatePayload(extra = {}) {
    return {
      client_id: "twitch-client-id",
      login: "djcoast",
      scopes: [],
      user_id: "141981764",
      expires_in: 14000,
      ...extra,
    };
  }

  function userPayload(extra = {}) {
    return {
      data: [{
        id: "141981764",
        login: "djcoast",
        display_name: "DJ Coast",
        broadcaster_type: "affiliate",
        profile_image_url: "https://static-cdn.jtvnw.net/profile.jpg",
        view_count: 999,
        description: "live tonight",
        ...extra,
      }],
    };
  }

  it("stays setup required until the Twitch client id and secret exist", async () => {
    expect(twitchConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(twitchConnector.capabilities).toEqual(["READ_PROFILE"]);
    const started = await startAccountConnection({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("requests the localhost callback with state and no extra scopes", async () => {
    configureTwitch();
    const session = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await twitchConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://id.twitch.tv");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("twitch-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/twitch/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("force_verify")).toBe("true");
    expect(url.searchParams.get("scope")).toBeNull();
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(started.authUrl).not.toMatch(FORBIDDEN);
    expect(started.authUrl).not.toContain("twitch-client-secret");
    const state = peekOAuthState(url.searchParams.get("state"));
    expect(state.provider).toBe("twitch");
    expect(state.accountId).toBe(session.id);
    expect(state.managedProfileId).toBe("prf_1");
    expect(state.pkceVerifier).toBeUndefined();
  });

  it("exchanges the code, validates the token, and keeps tokens in the vault", async () => {
    configureTwitch();
    const session = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await twitchConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const stateValue = new URL(started.authUrl).searchParams.get("state");
    const stateMeta = consumeOAuthState(stateValue);
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenPayload() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => validatePayload() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => userPayload() });
    const auth = await twitchConnector.completeAuth({
      code: "auth-code",
      state: stateValue,
      stateMeta,
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "141981764",
      displayName: "DJ Coast",
      handle: "@djcoast",
      profileUrl: "https://www.twitch.tv/djcoast",
      profileImageUrl: "https://static-cdn.jtvnw.net/profile.jpg",
      broadcasterType: "affiliate",
    });
    expect(auth.profile.viewCount).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/access-token|refresh-token|twitch-client-secret|auth-code|999/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://id.twitch.tv/oauth2/token");
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    expect(String(fetch.mock.calls[0][1].body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fapi%2Foauth%2Ftwitch%2Fcallback");
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(FORBIDDEN);
    expect(String(fetch.mock.calls[1][0])).toBe("https://id.twitch.tv/oauth2/validate");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe("OAuth access-token");
    expect(String(fetch.mock.calls[2][0])).toBe("https://api.twitch.tv/helix/users");
    expect(fetch.mock.calls[2][1].headers["Client-Id"]).toBe("twitch-client-id");
    expect(fetch.mock.calls.some((call) => /helix\/(channels|clips|chat|schedule|streams|analytics)/.test(String(call[0])))).toBe(false);
    const stored = getAccountTokens("twitch", session.id);
    expect(stored.accessToken).toBe("access-token");
    expect(stored.refreshToken).toBe("refresh-token");
    expect(stored.providerAccountId).toBe("141981764");
    expect(stored.scopes).toEqual([]);
    expect(stored.tokenType).toBe("bearer");
    expect(stored.expiresAt).toEqual(expect.any(String));
    expect(destinationsFromAuthResult("twitch", auth)).toEqual([expect.objectContaining({
      id: "twitch:141981764",
      externalId: "141981764",
      name: "DJ Coast",
      handle: "@djcoast",
      profileUrl: "https://www.twitch.tv/djcoast",
      type: "Twitch account",
      match: "login",
    })]);
    expect(peekOAuthState(stateValue).ok).toBe(false);
  });

  it("classifies review, rate, plan, and permission failures without storing a token", async () => {
    configureTwitch();
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({ status: 403, message: "This application is under review." }),
    });
    const review = await twitchConnector.completeAuth({
      code: "review-code",
      stateMeta: { accountId: "cxs_review", connectionId: "cxs_review" },
    });
    expect(review.code).toBe("REVIEW_REQUIRED");
    expect(failureFromAuth(review)).toBe("review");
    expect(getAccountTokens("twitch", "cxs_review")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ status: 429, message: "Rate limit exceeded." }),
    });
    const rate = await twitchConnector.completeAuth({
      code: "rate-code",
      stateMeta: { accountId: "cxs_rate", connectionId: "cxs_rate" },
    });
    expect(rate.code).toBe("RATE_LIMITED");
    expect(failureFromAuth(rate)).toBe("rate");

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ error: "payment_required", message: "A paid plan is required." }),
    });
    const plan = await twitchConnector.completeAuth({
      code: "plan-code",
      stateMeta: { accountId: "cxs_plan", connectionId: "cxs_plan" },
    });
    expect(plan.code).toBe("PLAN_REQUIRED");
    expect(failureFromAuth(plan)).toBe("plan");

    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenPayload() })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ status: 401, message: "missing scope for this request" }),
      });
    const permission = await twitchConnector.completeAuth({
      code: "perm-code",
      stateMeta: { accountId: "cxs_perm", connectionId: "cxs_perm" },
    });
    expect(permission.code).toBe("PERMISSION_MISSING");
    expect(JSON.stringify(permission)).not.toContain("access-token");
    expect(getAccountTokens("twitch", "cxs_perm")).toBeNull();
  });

  it("does not store a token when validation does not match the user", async () => {
    configureTwitch();
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenPayload() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => validatePayload({ user_id: "999" }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => userPayload() });
    const mismatch = await twitchConnector.completeAuth({
      code: "mismatch-code",
      stateMeta: { accountId: "cxs_mismatch", connectionId: "cxs_mismatch" },
    });
    expect(mismatch.code).toBe("PROVIDER_ERROR");
    expect(getAccountTokens("twitch", "cxs_mismatch")).toBeNull();
    expect(JSON.stringify(mismatch)).not.toMatch(/access-token|mismatch-code/);
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "twitch:141981764",
        provider: "twitch",
        platform: "Twitch",
        name: "DJ Coast",
        handle: "@djcoast",
        type: "Twitch account",
        externalId: "141981764",
        profileUrl: "https://www.twitch.tv/djcoast",
        match: "login",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("twitch", session.id, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      providerAccountId: "141981764",
      scopes: [],
      tokenType: "bearer",
    });
    const unselected = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: [],
    });
    expect(unselected.ok).toBe(false);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    const confirmed = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["twitch:141981764"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "141981764",
      displayName: "DJ Coast",
      handle: "@djcoast",
      profileUrl: "https://www.twitch.tv/djcoast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed)).not.toMatch(/access-token|refresh-token/);
    expect(getAccountTokens("twitch", confirmed.created[0].id).accessToken).toBe("access-token");
    expect(getAccountTokens("twitch", session.id)).toBeNull();
  });

  it("links a matching login and does not match a display name alone", async () => {
    const destination = {
      id: "twitch:141981764",
      provider: "twitch",
      platform: "Twitch",
      name: "DJ Coast",
      handle: "@djcoast",
      type: "Twitch account",
      externalId: "141981764",
      profileUrl: "https://www.twitch.tv/djcoast",
      match: "login",
    };
    expect(findLikelyManualMatch([{
      id: "acc_name",
      platform: "Twitch",
      displayName: "djcoast",
      handle: "",
      connectionState: "MANUAL_ONLY",
      providerAccountId: "",
    }], destination)).toBeNull();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_manual",
      platform: "Twitch",
      displayName: "Coast Ent",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
      managedProfileId: "prf_1",
      providerAccountId: "",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, { destinations: [destination] });
    const waiting = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["twitch:141981764"],
    });
    expect(waiting.failure).toBe("match");
    expect(waiting.needsChoice[0].accountId).toBe("acc_manual");
    const linked = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["twitch:141981764"],
      choices: { "twitch:141981764": "link" },
    });
    expect(linked.linked[0].id).toBe("acc_manual");
    expect(linked.linked[0].connectionState).toBe("CONNECTED");
    expect(linked.linked[0].providerAccountId).toBe("141981764");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
    const again = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["twitch:141981764"],
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.created).toEqual([]);
    expect(duplicate.linked[0].id).toBe("acc_manual");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses another workspace, rotates the refresh token, and does not start a stream", async () => {
    configureTwitch();
    const session = createConnectionSession({
      provider: "twitch",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["twitch:141981764"],
    });
    expect(foreign.failure).toBe("workspace");
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("twitch", "acc_tw", {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      providerAccountId: "141981764",
      scopes: [],
      tokenType: "bearer",
    });
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => tokenPayload({
        access_token: "new-access",
        refresh_token: "new-refresh",
      }),
    });
    const refreshed = await twitchConnector.refreshAuth({ id: "acc_tw" });
    expect(refreshed.ok).toBe(true);
    expect(JSON.stringify(refreshed)).not.toMatch(/new-access|new-refresh|old-refresh|twitch-client-secret/);
    expect(getAccountTokens("twitch", "acc_tw")).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      providerAccountId: "141981764",
      tokenType: "bearer",
    });
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(/channels|chat|clips/);
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const disconnected = await twitchConnector.disconnect({ id: "acc_tw" });
    expect(disconnected.ok).toBe(true);
    expect(String(fetch.mock.calls[1][0])).toBe("https://id.twitch.tv/oauth2/revoke");
    expect(String(fetch.mock.calls[1][1].body)).toContain("token=new-access");
    expect(getAccountTokens("twitch", "acc_tw")).toBeNull();
    const blocked = await twitchConnector.publishContent({ id: "acc_tw" }, { text: "hello" });
    expect(blocked.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });
});
