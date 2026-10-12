import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-tt-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-tt-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { consumeOAuthState, peekOAuthState } = await import("./oauth/state.js");
const { tiktokConnector } = await import("./providers/tiktok.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult, failureFromAuth } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET", "TIKTOK_REDIRECT_URI", "AUTH_URL"];

describe("tiktok connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.TIKTOK_CLIENT_KEY;
    delete process.env.TIKTOK_CLIENT_SECRET;
    delete process.env.TIKTOK_REDIRECT_URI;
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

  function configureTikTok() {
    process.env.TIKTOK_CLIENT_KEY = "tiktok-client-key";
    process.env.TIKTOK_CLIENT_SECRET = "tiktok-client-secret";
  }

  it("stays setup required until the TikTok client key and secret exist", async () => {
    expect(tiktokConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(tiktokConnector.capabilities).toEqual(["READ_PROFILE"]);
    const started = await startAccountConnection({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("sends Login Kit PKCE with user.info.basic and the localhost callback", async () => {
    configureTikTok();
    const session = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await tiktokConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://www.tiktok.com");
    expect(url.pathname).toBe("/v2/auth/authorize/");
    expect(url.searchParams.get("client_key")).toBe("tiktok-client-key");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/tiktok/callback");
    expect(url.searchParams.get("scope")).toBe("user.info.basic");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    const state = peekOAuthState(url.searchParams.get("state"));
    const challenge = url.searchParams.get("code_challenge");
    expect(challenge).toBe(createHash("sha256").update(state.pkceVerifier).digest("hex"));
    expect(challenge).toMatch(/^[a-f0-9]{64}$/);
    expect(started.authUrl).not.toContain("tiktok-client-secret");
    expect(started.authUrl).not.toContain(state.pkceVerifier);
    expect(started.authUrl).not.toContain("video.publish");
    expect(state.provider).toBe("tiktok");
    expect(state.accountId).toBe(session.id);
  });

  it("exchanges the code, discovers one profile, and keeps tokens in the vault", async () => {
    configureTikTok();
    const session = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await tiktokConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const stateValue = new URL(started.authUrl).searchParams.get("state");
    const stateMeta = consumeOAuthState(stateValue);
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "access-token",
          refresh_token: "refresh-token",
          expires_in: 86400,
          refresh_expires_in: 31536000,
          open_id: "tt_open_1",
          scope: "user.info.basic",
          token_type: "Bearer",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            user: {
              open_id: "tt_open_1",
              union_id: "tt_union_1",
              display_name: "DJ Coast",
              avatar_url: "https://example.test/avatar.jpg",
            },
          },
          error: { code: "ok", message: "", log_id: "log_1" },
        }),
      });
    const auth = await tiktokConnector.completeAuth({
      code: "auth-code",
      state: stateValue,
      stateMeta,
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "tt_open_1",
      displayName: "DJ Coast",
      handle: "",
      profileUrl: "",
      profileImageUrl: "https://example.test/avatar.jpg",
      unionId: "tt_union_1",
    });
    expect(auth.profile.followerCount).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/access-token|refresh-token|tiktok-client-secret|auth-code|code_verifier/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://open.tiktokapis.com/v2/oauth/token/");
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    expect(String(fetch.mock.calls[0][1].body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fapi%2Foauth%2Ftiktok%2Fcallback");
    expect(String(fetch.mock.calls[0][1].body)).toContain(`code_verifier=${stateMeta.pkceVerifier}`);
    expect(String(fetch.mock.calls[1][0])).toContain("https://open.tiktokapis.com/v2/user/info/?fields=open_id%2Cunion_id%2Cavatar_url%2Cdisplay_name");
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("video"))).toBe(false);
    const stored = getAccountTokens("tiktok", session.id);
    expect(stored.accessToken).toBe("access-token");
    expect(stored.refreshToken).toBe("refresh-token");
    expect(stored.providerAccountId).toBe("tt_open_1");
    expect(stored.scopes).toEqual(["user.info.basic"]);
    expect(destinationsFromAuthResult("tiktok", auth)).toEqual([expect.objectContaining({
      id: "tiktok:tt_open_1",
      externalId: "tt_open_1",
      name: "DJ Coast",
      type: "TikTok account",
    })]);
    expect(peekOAuthState(stateValue).ok).toBe(false);
  });

  it("classifies review, rate, plan, and permission failures without storing a token", async () => {
    configureTikTok();
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_request", error_description: "The user is not a target user of this sandbox." }),
    });
    const review = await tiktokConnector.completeAuth({
      code: "review-code",
      stateMeta: { accountId: "cxs_review", connectionId: "cxs_review", pkceVerifier: "verifier-review" },
    });
    expect(review.code).toBe("REVIEW_REQUIRED");
    expect(failureFromAuth(review)).toBe("review");
    expect(JSON.stringify(review)).not.toContain("verifier-review");
    expect(getAccountTokens("tiktok", "cxs_review")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "rate_limit_exceeded", error_description: "Too many requests." }),
    });
    const rate = await tiktokConnector.completeAuth({
      code: "rate-code",
      stateMeta: { accountId: "cxs_rate", connectionId: "cxs_rate", pkceVerifier: "verifier-rate" },
    });
    expect(rate.code).toBe("RATE_LIMITED");
    expect(failureFromAuth(rate)).toBe("rate");

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ error: "payment_required", error_description: "A paid plan is required." }),
    });
    const plan = await tiktokConnector.completeAuth({
      code: "plan-code",
      stateMeta: { accountId: "cxs_plan", connectionId: "cxs_plan", pkceVerifier: "verifier-plan" },
    });
    expect(plan.code).toBe("PLAN_REQUIRED");
    expect(failureFromAuth(plan)).toBe("plan");

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 86400, open_id: "tt_open_1", scope: "user.info.basic" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "scope_not_authorized", message: "The user did not grant user.info.basic.", log_id: "log_2" } }),
      });
    const permission = await tiktokConnector.completeAuth({
      code: "perm-code",
      stateMeta: { accountId: "cxs_perm", connectionId: "cxs_perm", pkceVerifier: "verifier-perm" },
    });
    expect(permission.code).toBe("PERMISSION_MISSING");
    expect(JSON.stringify(permission)).not.toContain("access-token");
    expect(getAccountTokens("tiktok", "cxs_perm")).toBeNull();
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "tiktok:tt_open_1",
        provider: "tiktok",
        platform: "TikTok",
        name: "DJ Coast",
        handle: "",
        type: "TikTok account",
        externalId: "tt_open_1",
        profileUrl: "",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("tiktok", session.id, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      providerAccountId: "tt_open_1",
      scopes: ["user.info.basic"],
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
      selectedIds: ["tiktok:tt_open_1"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "tt_open_1",
      displayName: "DJ Coast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed)).not.toMatch(/access-token|refresh-token/);
    expect(getAccountTokens("tiktok", confirmed.created[0].id).accessToken).toBe("access-token");
    expect(getAccountTokens("tiktok", session.id)).toBeNull();
  });

  it("offers a manual match and blocks a second verified identity", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_manual",
      platform: "TikTok",
      displayName: "DJ Coast",
      handle: "",
      connectionState: "MANUAL_ONLY",
      managedProfileId: "prf_1",
      providerAccountId: "",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const destination = {
      id: "tiktok:tt_open_1",
      provider: "tiktok",
      platform: "TikTok",
      name: "DJ Coast",
      handle: "",
      type: "TikTok account",
      externalId: "tt_open_1",
      profileUrl: "",
    };
    updateConnectionSession(session.id, { destinations: [destination] });
    const waiting = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["tiktok:tt_open_1"],
    });
    expect(waiting.failure).toBe("match");
    expect(waiting.needsChoice[0].accountId).toBe("acc_manual");
    const linked = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["tiktok:tt_open_1"],
      choices: { "tiktok:tt_open_1": "link" },
    });
    expect(linked.linked[0].id).toBe("acc_manual");
    expect(linked.linked[0].connectionState).toBe("CONNECTED");
    expect(linked.linked[0].providerAccountId).toBe("tt_open_1");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
    const again = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["tiktok:tt_open_1"],
    });
    expect(duplicate.ok).toBe(true);
    expect(duplicate.created).toEqual([]);
    expect(duplicate.linked[0].id).toBe("acc_manual");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses another workspace, refreshes in place, and does not publish", async () => {
    configureTikTok();
    const session = createConnectionSession({
      provider: "tiktok",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["tiktok:tt_open_1"],
    });
    expect(foreign.failure).toBe("workspace");
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("tiktok", "acc_tt", {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      providerAccountId: "tt_open_1",
      scopes: ["user.info.basic"],
    });
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 86400,
        open_id: "tt_open_1",
        scope: "user.info.basic",
      }),
    });
    const refreshed = await tiktokConnector.refreshAuth({ id: "acc_tt" });
    expect(refreshed.ok).toBe(true);
    expect(JSON.stringify(refreshed)).not.toMatch(/new-access|new-refresh|old-refresh|tiktok-client-secret/);
    expect(getAccountTokens("tiktok", "acc_tt")).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      providerAccountId: "tt_open_1",
    });
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    const disconnected = await tiktokConnector.disconnect({ id: "acc_tt" });
    expect(disconnected.ok).toBe(true);
    expect(getAccountTokens("tiktok", "acc_tt")).toBeNull();
    const blocked = await tiktokConnector.publishContent({ id: "acc_tt" }, { text: "hello" });
    expect(blocked.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
