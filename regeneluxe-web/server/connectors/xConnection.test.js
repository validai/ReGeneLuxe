import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-x-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-x-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { consumeOAuthState, peekOAuthState } = await import("./oauth/state.js");
const { xConnector } = await import("./providers/x.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult, failureFromAuth } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["X_CLIENT_ID", "X_CLIENT_SECRET", "X_REDIRECT_URI", "AUTH_URL"];

describe("x connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.X_CLIENT_ID;
    delete process.env.X_CLIENT_SECRET;
    delete process.env.X_REDIRECT_URI;
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

  function configureX() {
    process.env.X_CLIENT_ID = "x-client-id";
    process.env.X_CLIENT_SECRET = "x-client-secret";
  }

  it("stays setup required until the X client id and secret exist", async () => {
    expect(xConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(xConnector.capabilities).toEqual(["READ_PROFILE"]);
    const started = await startAccountConnection({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("sends OAuth 2.0 PKCE to x.com with users.read and offline.access", async () => {
    configureX();
    process.env.X_REDIRECT_URI = "http://127.0.0.1:5174/api/oauth/x/callback";
    const session = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await xConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      returnTo: `/accounts?connect=select&session=${session.id}`,
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://x.com");
    expect(url.pathname).toBe("/i/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("x-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/x/callback");
    expect(url.searchParams.get("scope")).toBe("users.read offline.access");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toBeTruthy();
    expect(started.authUrl).not.toContain("x-client-secret");
    expect(started.authUrl).not.toContain("tweet.write");
    const state = peekOAuthState(url.searchParams.get("state"));
    expect(state.provider).toBe("x");
    expect(state.accountId).toBe(session.id);
    expect(state.pkceVerifier).toBeTruthy();
    expect(started.authUrl).not.toContain(state.pkceVerifier);
    expect(JSON.stringify(started)).not.toContain(state.pkceVerifier);
  });

  it("exchanges the code, discovers one profile, and keeps tokens in the vault", async () => {
    configureX();
    const session = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await xConnector.beginAuth({
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
          expires_in: 7200,
          scope: "users.read offline.access",
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            id: "x_1",
            username: "djcoast",
            name: "DJ Coast",
            profile_image_url: "https://pbs.twimg.com/profile.jpg",
          },
        }),
      });
    const auth = await xConnector.completeAuth({
      code: "auth-code",
      state: stateValue,
      stateMeta,
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "x_1",
      displayName: "DJ Coast",
      handle: "@djcoast",
      profileUrl: "https://x.com/djcoast",
      profileImageUrl: "https://pbs.twimg.com/profile.jpg",
    });
    expect(auth.profile.followerCount).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/access-token|refresh-token|x-client-secret|auth-code|code_verifier/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://api.x.com/2/oauth2/token");
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    expect(String(fetch.mock.calls[0][1].body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fapi%2Foauth%2Fx%2Fcallback");
    expect(String(fetch.mock.calls[0][1].body)).toContain(`code_verifier=${stateMeta.pkceVerifier}`);
    expect(String(fetch.mock.calls[0][1].body)).not.toContain("x-client-secret");
    expect(String(fetch.mock.calls[0][1].headers.Authorization)).toMatch(/^Basic /);
    expect(String(fetch.mock.calls[1][0])).toContain("https://api.x.com/2/users/me?user.fields=id%2Cusername%2Cname%2Cprofile_image_url");
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("/2/tweets"))).toBe(false);
    const stored = getAccountTokens("x", session.id);
    expect(stored.accessToken).toBe("access-token");
    expect(stored.refreshToken).toBe("refresh-token");
    expect(stored.providerAccountId).toBe("x_1");
    expect(stored.scopes).toEqual(["users.read", "offline.access"]);
    const destinations = destinationsFromAuthResult("x", auth);
    expect(destinations).toEqual([expect.objectContaining({
      id: "x:x_1",
      externalId: "x_1",
      handle: "@djcoast",
      type: "X account",
    })]);
    expect(peekOAuthState(stateValue).ok).toBe(false);
  });

  it("classifies plan, rate, permission, and reconnect failures without storing a token", async () => {
    configureX();
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 402,
      json: async () => ({ title: "CreditsDepleted", detail: "Your account does not have any credits." }),
    });
    const plan = await xConnector.completeAuth({
      code: "plan-code",
      stateMeta: { accountId: "cxs_plan", connectionId: "cxs_plan", pkceVerifier: "verifier-plan" },
    });
    expect(plan.code).toBe("PLAN_REQUIRED");
    expect(failureFromAuth(plan)).toBe("plan");
    expect(JSON.stringify(plan)).not.toContain("verifier-plan");
    expect(getAccountTokens("x", "cxs_plan")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ title: "Too Many Requests", detail: "Rate limit exceeded." }),
    });
    const rate = await xConnector.completeAuth({
      code: "rate-code",
      stateMeta: { accountId: "cxs_rate", connectionId: "cxs_rate", pkceVerifier: "verifier-rate" },
    });
    expect(rate.code).toBe("RATE_LIMITED");
    expect(failureFromAuth(rate)).toBe("rate");
    expect(getAccountTokens("x", "cxs_rate")).toBeNull();

    fetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ access_token: "access-token", refresh_token: "refresh-token", expires_in: 7200 }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ title: "Forbidden", detail: "The users.read scope was not authorized." }),
      });
    const permission = await xConnector.completeAuth({
      code: "perm-code",
      stateMeta: { accountId: "cxs_perm", connectionId: "cxs_perm", pkceVerifier: "verifier-perm" },
    });
    expect(permission.code).toBe("PERMISSION_MISSING");
    expect(JSON.stringify(permission)).not.toContain("access-token");
    expect(getAccountTokens("x", "cxs_perm")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant", error_description: "code was already used" }),
    });
    const reconnect = await xConnector.completeAuth({
      code: "used-code",
      stateMeta: { accountId: "cxs_used", connectionId: "cxs_used", pkceVerifier: "verifier-used" },
    });
    expect(reconnect.code).toBe("RECONNECT_REQUIRED");
    expect(getAccountTokens("x", "cxs_used")).toBeNull();
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "x:x_1",
        provider: "x",
        platform: "X",
        name: "DJ Coast",
        handle: "@djcoast",
        type: "X account",
        externalId: "x_1",
        profileUrl: "https://x.com/djcoast",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("x", session.id, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      providerAccountId: "x_1",
      scopes: ["users.read", "offline.access"],
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
      selectedIds: ["x:x_1"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "x_1",
      handle: "@djcoast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed)).not.toMatch(/access-token|refresh-token/);
    expect(getAccountTokens("x", confirmed.created[0].id).accessToken).toBe("access-token");
    expect(getAccountTokens("x", session.id)).toBeNull();
  });

  it("offers a manual match and blocks a second verified identity", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_manual",
      platform: "X",
      displayName: "djcoast",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
      managedProfileId: "prf_1",
      providerAccountId: "",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const destination = {
      id: "x:x_1",
      provider: "x",
      platform: "X",
      name: "DJ Coast",
      handle: "@djcoast",
      type: "X account",
      externalId: "x_1",
      profileUrl: "https://x.com/djcoast",
    };
    updateConnectionSession(session.id, { destinations: [destination] });
    const waiting = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["x:x_1"],
    });
    expect(waiting.failure).toBe("match");
    expect(waiting.needsChoice[0].accountId).toBe("acc_manual");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);

    const linked = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["x:x_1"],
      choices: { "x:x_1": "link" },
    });
    expect(linked.linked[0].id).toBe("acc_manual");
    expect(linked.linked[0].connectionState).toBe("CONNECTED");
    expect(linked.linked[0].providerAccountId).toBe("x_1");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);

    const again = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["x:x_1"],
    });
    expect(duplicate.failure).toBe("duplicate");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses another workspace, refreshes in place, and disconnects the vault entry", async () => {
    configureX();
    const session = createConnectionSession({
      provider: "x",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["x:x_1"],
    });
    expect(foreign.failure).toBe("workspace");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);

    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("x", "acc_x", {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      providerAccountId: "x_1",
      scopes: ["users.read", "offline.access"],
    });
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        access_token: "new-access",
        refresh_token: "new-refresh",
        expires_in: 7200,
        scope: "users.read offline.access",
      }),
    });
    const refreshed = await xConnector.refreshAuth({ id: "acc_x" });
    expect(refreshed.ok).toBe(true);
    expect(JSON.stringify(refreshed)).not.toMatch(/new-access|new-refresh|old-refresh/);
    expect(getAccountTokens("x", "acc_x")).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      providerAccountId: "x_1",
    });
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
    expect(String(fetch.mock.calls[0][1].body)).not.toContain("x-client-secret");

    const disconnected = await xConnector.disconnect({ id: "acc_x" });
    expect(disconnected.ok).toBe(true);
    expect(getAccountTokens("x", "acc_x")).toBeNull();
    const blocked = await xConnector.publishContent({ id: "acc_x" }, { text: "hello" });
    expect(blocked.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
