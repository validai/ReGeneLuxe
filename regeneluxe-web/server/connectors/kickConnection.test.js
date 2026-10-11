import { createHash } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-kick-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-kick-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { consumeOAuthState, peekOAuthState } = await import("./oauth/state.js");
const { kickConnector } = await import("./providers/kick.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult, failureFromAuth, findLikelyManualMatch } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["KICK_CLIENT_ID", "KICK_CLIENT_SECRET", "KICK_REDIRECT_URI", "AUTH_URL"];
const FORBIDDEN = /channel:read|channel:write|channel:rewards|chat:write|streamkey:read|events:subscribe|moderation:|kicks:read|ads:read|ads:write/;

describe("kick connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.KICK_CLIENT_ID;
    delete process.env.KICK_CLIENT_SECRET;
    delete process.env.KICK_REDIRECT_URI;
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

  function configureKick() {
    process.env.KICK_CLIENT_ID = "kick-client-id";
    process.env.KICK_CLIENT_SECRET = "kick-client-secret";
  }

  function tokenPayload(extra = {}) {
    return {
      access_token: "access-token",
      token_type: "bearer",
      refresh_token: "refresh-token",
      expires_in: 3600,
      scope: "user:read",
      ...extra,
    };
  }

  function introspectPayload(extra = {}) {
    return {
      data: {
        active: true,
        client_id: "kick-client-id",
        token_type: "user",
        scope: "user:read",
        exp: 1893456000,
        ...extra,
      },
      message: "OK",
    };
  }

  function userPayload(extra = {}) {
    return {
      data: [{
        user_id: 1820952,
        name: "djcoast",
        email: "hidden@example.test",
        profile_picture: "https://files.kick.com/avatar.webp",
        ...extra,
      }],
      message: "OK",
    };
  }

  it("stays setup required until the Kick client id and secret exist", async () => {
    expect(kickConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(kickConnector.capabilities).toEqual(["READ_PROFILE"]);
    const started = await startAccountConnection({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("sends PKCE S256, user:read, and the localhost callback", async () => {
    configureKick();
    const session = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await kickConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://id.kick.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("kick-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/kick/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("user:read");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(started.authUrl).not.toMatch(FORBIDDEN);
    expect(started.authUrl).not.toContain("kick-client-secret");
    const state = peekOAuthState(url.searchParams.get("state"));
    const challenge = url.searchParams.get("code_challenge");
    expect(challenge).toBe(createHash("sha256").update(state.pkceVerifier).digest("base64url"));
    expect(challenge).not.toBe(createHash("sha256").update(state.pkceVerifier).digest("hex"));
    expect(started.authUrl).not.toContain(state.pkceVerifier);
    expect(state.provider).toBe("kick");
    expect(state.accountId).toBe(session.id);
    expect(state.managedProfileId).toBe("prf_1");
  });

  it("exchanges the code, introspects the user token, and keeps tokens in the vault", async () => {
    configureKick();
    const session = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await kickConnector.beginAuth({
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
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => introspectPayload() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => userPayload() });
    const auth = await kickConnector.completeAuth({
      code: "auth-code",
      state: stateValue,
      stateMeta,
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "1820952",
      displayName: "djcoast",
      handle: "@djcoast",
      profileUrl: "https://kick.com/djcoast",
      profileImageUrl: "https://files.kick.com/avatar.webp",
    });
    expect(auth.profile.email).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/access-token|refresh-token|kick-client-secret|auth-code|code_verifier|hidden@example/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://id.kick.com/oauth/token");
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    expect(String(fetch.mock.calls[0][1].body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fapi%2Foauth%2Fkick%2Fcallback");
    expect(String(fetch.mock.calls[0][1].body)).toContain(`code_verifier=${stateMeta.pkceVerifier}`);
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(FORBIDDEN);
    expect(String(fetch.mock.calls[1][0])).toBe("https://id.kick.com/oauth/token/introspect");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer access-token");
    expect(String(fetch.mock.calls[2][0])).toBe("https://api.kick.com/public/v1/users");
    expect(fetch.mock.calls.some((call) => /\/(channels|chat|events|moderation|ads|livestreams)/.test(String(call[0])))).toBe(false);
    const stored = getAccountTokens("kick", session.id);
    expect(stored.accessToken).toBe("access-token");
    expect(stored.refreshToken).toBe("refresh-token");
    expect(stored.providerAccountId).toBe("1820952");
    expect(stored.scopes).toEqual(["user:read"]);
    expect(stored.tokenType).toBe("bearer");
    expect(stored.expiresAt).toEqual(expect.any(String));
    expect(destinationsFromAuthResult("kick", auth)).toEqual([expect.objectContaining({
      id: "kick:1820952",
      externalId: "1820952",
      name: "djcoast",
      handle: "@djcoast",
      profileUrl: "https://kick.com/djcoast",
      type: "Kick account",
      match: "login",
    })]);
    expect(peekOAuthState(stateValue).ok).toBe(false);
  });

  it("classifies pkce, redirect, rate, and inactive-token failures without storing a token", async () => {
    configureKick();
    const fetch = vi.mocked(global.fetch);
    const missing = await kickConnector.completeAuth({
      code: "missing-verifier",
      stateMeta: { accountId: "cxs_pkce", connectionId: "cxs_pkce" },
    });
    expect(missing.code).toBe("INVALID_PKCE");
    expect(failureFromAuth(missing)).toBe("reconnect");
    expect(JSON.stringify(missing)).not.toContain("missing-verifier");
    expect(fetch).not.toHaveBeenCalled();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_grant", message: "code_verifier mismatch" }),
    });
    const pkce = await kickConnector.completeAuth({
      code: "pkce-code",
      stateMeta: { accountId: "cxs_pkce2", connectionId: "cxs_pkce2", pkceVerifier: "verifier-pkce" },
    });
    expect(pkce.code).toBe("INVALID_PKCE");
    expect(JSON.stringify(pkce)).not.toContain("verifier-pkce");
    expect(getAccountTokens("kick", "cxs_pkce2")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_request", message: "redirect_uri does not match" }),
    });
    const redirect = await kickConnector.completeAuth({
      code: "redirect-code",
      stateMeta: { accountId: "cxs_redirect", connectionId: "cxs_redirect", pkceVerifier: "verifier-redirect" },
    });
    expect(redirect.code).toBe("INVALID_REDIRECT");
    expect(failureFromAuth(redirect)).toBe("setup");

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: "Rate limit exceeded." }),
    });
    const rate = await kickConnector.completeAuth({
      code: "rate-code",
      stateMeta: { accountId: "cxs_rate", connectionId: "cxs_rate", pkceVerifier: "verifier-rate" },
    });
    expect(rate.code).toBe("RATE_LIMITED");
    expect(failureFromAuth(rate)).toBe("rate");

    fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => tokenPayload() })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => introspectPayload({ active: false, scope: "", token_type: "", client_id: "" }) });
    const inactive = await kickConnector.completeAuth({
      code: "inactive-code",
      stateMeta: { accountId: "cxs_inactive", connectionId: "cxs_inactive", pkceVerifier: "verifier-inactive" },
    });
    expect(inactive.code).toBe("TOKEN_INACTIVE");
    expect(failureFromAuth(inactive)).toBe("reconnect");
    expect(JSON.stringify(inactive)).not.toContain("access-token");
    expect(getAccountTokens("kick", "cxs_inactive")).toBeNull();
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "kick:1820952",
        provider: "kick",
        platform: "Kick",
        name: "djcoast",
        handle: "@djcoast",
        type: "Kick account",
        externalId: "1820952",
        profileUrl: "https://kick.com/djcoast",
        match: "login",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("kick", session.id, {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      providerAccountId: "1820952",
      scopes: ["user:read"],
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
      selectedIds: ["kick:1820952"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "1820952",
      displayName: "djcoast",
      handle: "@djcoast",
      profileUrl: "https://kick.com/djcoast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed)).not.toMatch(/access-token|refresh-token/);
    expect(getAccountTokens("kick", confirmed.created[0].id).accessToken).toBe("access-token");
    expect(getAccountTokens("kick", session.id)).toBeNull();
  });

  it("links a matching username and does not match a display name alone", async () => {
    const destination = {
      id: "kick:1820952",
      provider: "kick",
      platform: "Kick",
      name: "DJ Coast",
      handle: "@djcoast",
      type: "Kick account",
      externalId: "1820952",
      profileUrl: "https://kick.com/djcoast",
      match: "login",
    };
    expect(findLikelyManualMatch([{
      id: "acc_name",
      platform: "Kick",
      displayName: "djcoast",
      handle: "",
      connectionState: "MANUAL_ONLY",
      providerAccountId: "",
    }], destination)).toBeNull();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_manual",
      platform: "Kick",
      displayName: "Coast Ent",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
      managedProfileId: "prf_1",
      providerAccountId: "",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, { destinations: [destination] });
    const waiting = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["kick:1820952"],
    });
    expect(waiting.failure).toBe("match");
    expect(waiting.needsChoice[0].accountId).toBe("acc_manual");
    const linked = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["kick:1820952"],
      choices: { "kick:1820952": "link" },
    });
    expect(linked.linked[0].id).toBe("acc_manual");
    expect(linked.linked[0].connectionState).toBe("CONNECTED");
    expect(linked.linked[0].providerAccountId).toBe("1820952");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
    const again = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["kick:1820952"],
    });
    expect(duplicate.failure).toBe("duplicate");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses another workspace, rotates the refresh token, and does not call channel APIs", async () => {
    configureKick();
    const session = createConnectionSession({
      provider: "kick",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["kick:1820952"],
    });
    expect(foreign.failure).toBe("workspace");
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("kick", "acc_kick", {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      providerAccountId: "1820952",
      scopes: ["user:read"],
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
    const refreshed = await kickConnector.refreshAuth({ id: "acc_kick" });
    expect(refreshed.ok).toBe(true);
    expect(JSON.stringify(refreshed)).not.toMatch(/new-access|new-refresh|old-refresh|kick-client-secret/);
    expect(getAccountTokens("kick", "acc_kick")).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      providerAccountId: "1820952",
      tokenType: "bearer",
    });
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(FORBIDDEN);
    fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });
    const disconnected = await kickConnector.disconnect({ id: "acc_kick" });
    expect(disconnected.ok).toBe(true);
    const revokeUrl = new URL(String(fetch.mock.calls[1][0]));
    expect(revokeUrl.origin).toBe("https://id.kick.com");
    expect(revokeUrl.pathname).toBe("/oauth/revoke");
    expect(revokeUrl.searchParams.get("token_hint_type")).toBe("refresh_token");
    expect(getAccountTokens("kick", "acc_kick")).toBeNull();
    const blocked = await kickConnector.publishContent({ id: "acc_kick" }, { text: "hello" });
    expect(blocked.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });
});
