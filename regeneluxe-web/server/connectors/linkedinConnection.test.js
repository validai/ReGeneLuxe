import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-li-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-li-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { consumeOAuthState, peekOAuthState } = await import("./oauth/state.js");
const { linkedinConnector } = await import("./providers/linkedin.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult, failureFromAuth, findLikelyManualMatch } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET", "LINKEDIN_REDIRECT_URI", "AUTH_URL"];
const FORBIDDEN = /w_member_social|w_organization_social|r_organization_social|rw_organization_admin|r_ads|rw_ads/;

describe("linkedin connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.LINKEDIN_CLIENT_ID;
    delete process.env.LINKEDIN_CLIENT_SECRET;
    delete process.env.LINKEDIN_REDIRECT_URI;
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

  function configureLinkedIn() {
    process.env.LINKEDIN_CLIENT_ID = "linkedin-client-id";
    process.env.LINKEDIN_CLIENT_SECRET = "linkedin-client-secret";
  }

  function tokenPayload(extra = {}) {
    return {
      access_token: "access-token",
      expires_in: 5184000,
      scope: "openid profile",
      token_type: "Bearer",
      id_token: "id-token-value",
      ...extra,
    };
  }

  function userInfo(extra = {}) {
    return {
      sub: "member-sub-1",
      name: "DJ Coast",
      given_name: "DJ",
      family_name: "Coast",
      picture: "https://media.licdn.com/profile.jpg",
      email: "hidden@example.test",
      email_verified: true,
      locale: "en-US",
      ...extra,
    };
  }

  it("stays setup required until the LinkedIn client id and secret exist", async () => {
    expect(linkedinConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(linkedinConnector.capabilities).toEqual(["READ_PROFILE"]);
    const started = await startAccountConnection({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("requests openid and profile on the localhost callback without PKCE", async () => {
    configureLinkedIn();
    const session = createConnectionSession({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await linkedinConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://www.linkedin.com");
    expect(url.pathname).toBe("/oauth/v2/authorization");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("linkedin-client-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/linkedin/callback");
    expect(url.searchParams.get("scope")).toBe("openid profile");
    expect(url.searchParams.get("code_challenge")).toBeNull();
    expect(started.authUrl).not.toMatch(FORBIDDEN);
    expect(started.authUrl).not.toContain("linkedin-client-secret");
    const state = peekOAuthState(url.searchParams.get("state"));
    expect(state.provider).toBe("linkedin");
    expect(state.accountId).toBe(session.id);
    expect(state.managedProfileId).toBe("prf_1");
    expect(state.pkceVerifier).toBeUndefined();
  });

  it("exchanges the code, reads the member subject, and keeps tokens in the vault", async () => {
    configureLinkedIn();
    const session = createConnectionSession({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await linkedinConnector.beginAuth({
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
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => userInfo() });
    const auth = await linkedinConnector.completeAuth({
      code: "auth-code",
      state: stateValue,
      stateMeta,
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "member-sub-1",
      displayName: "DJ Coast",
      handle: "",
      profileUrl: "",
      profileImageUrl: "https://media.licdn.com/profile.jpg",
      givenName: "DJ",
      familyName: "Coast",
    });
    expect(auth.profile.email).toBeUndefined();
    expect(JSON.stringify(auth)).not.toMatch(/access-token|linkedin-client-secret|auth-code|id-token-value|hidden@example/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://www.linkedin.com/oauth/v2/accessToken");
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    expect(String(fetch.mock.calls[0][1].body)).toContain("redirect_uri=http%3A%2F%2Flocalhost%3A5174%2Fapi%2Foauth%2Flinkedin%2Fcallback");
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(FORBIDDEN);
    expect(String(fetch.mock.calls[1][0])).toBe("https://api.linkedin.com/v2/userinfo");
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer access-token");
    expect(fetch.mock.calls.some((call) => /ugcPosts|shares|images|assets|organizationalEntityAcls|adAccounts/.test(String(call[0])))).toBe(false);
    const stored = getAccountTokens("linkedin", session.id);
    expect(stored.accessToken).toBe("access-token");
    expect(stored.refreshToken).toBeNull();
    expect(stored.providerAccountId).toBe("member-sub-1");
    expect(stored.scopes).toEqual(["openid", "profile"]);
    expect(stored.tokenType).toBe("bearer");
    expect(stored.expiresAt).toEqual(expect.any(String));
    expect(destinationsFromAuthResult("linkedin", auth)).toEqual([expect.objectContaining({
      id: "linkedin:member-sub-1",
      externalId: "member-sub-1",
      name: "DJ Coast",
      handle: "",
      type: "LinkedIn member",
      match: "login",
    })]);
    expect(peekOAuthState(stateValue).ok).toBe(false);
  });

  it("classifies review, redirect, and rate failures without storing a token", async () => {
    configureLinkedIn();
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: "invalid_scope", error_description: "The requested scope is invalid." }),
    });
    const review = await linkedinConnector.completeAuth({
      code: "review-code",
      stateMeta: { accountId: "cxs_review", connectionId: "cxs_review" },
    });
    expect(review.code).toBe("REVIEW_REQUIRED");
    expect(failureFromAuth(review)).toBe("review");
    expect(JSON.stringify(review)).not.toContain("review-code");
    expect(getAccountTokens("linkedin", "cxs_review")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error: "invalid_redirect_uri", error_description: "Unable to retrieve access token: redirect uri does not match." }),
    });
    const redirect = await linkedinConnector.completeAuth({
      code: "redirect-code",
      stateMeta: { accountId: "cxs_redirect", connectionId: "cxs_redirect" },
    });
    expect(redirect.code).toBe("INVALID_REDIRECT");
    expect(failureFromAuth(redirect)).toBe("setup");

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ message: "Rate limit exceeded." }),
    });
    const rate = await linkedinConnector.completeAuth({
      code: "rate-code",
      stateMeta: { accountId: "cxs_rate", connectionId: "cxs_rate" },
    });
    expect(rate.code).toBe("RATE_LIMITED");
    expect(failureFromAuth(rate)).toBe("rate");
    expect(getAccountTokens("linkedin", "cxs_rate")).toBeNull();
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "linkedin:member-sub-1",
        provider: "linkedin",
        platform: "LinkedIn",
        name: "DJ Coast",
        handle: "",
        type: "LinkedIn member",
        externalId: "member-sub-1",
        profileUrl: "",
        match: "login",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("linkedin", session.id, {
      accessToken: "access-token",
      providerAccountId: "member-sub-1",
      scopes: ["openid", "profile"],
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
      selectedIds: ["linkedin:member-sub-1"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "member-sub-1",
      displayName: "DJ Coast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed)).not.toMatch(/access-token/);
    expect(getAccountTokens("linkedin", confirmed.created[0].id).accessToken).toBe("access-token");
    expect(getAccountTokens("linkedin", session.id)).toBeNull();
  });

  it("does not link a display name and blocks a second verified member", async () => {
    const destination = {
      id: "linkedin:member-sub-1",
      provider: "linkedin",
      platform: "LinkedIn",
      name: "DJ Coast",
      handle: "",
      type: "LinkedIn member",
      externalId: "member-sub-1",
      profileUrl: "",
      match: "login",
    };
    expect(findLikelyManualMatch([{
      id: "acc_name",
      platform: "LinkedIn",
      displayName: "DJ Coast",
      handle: "",
      connectionState: "MANUAL_ONLY",
      providerAccountId: "",
    }], destination)).toBeNull();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_verified",
      platform: "LinkedIn",
      displayName: "DJ Coast",
      handle: "",
      connectionState: "CONNECTED",
      managedProfileId: "prf_1",
      providerAccountId: "member-sub-1",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["linkedin:member-sub-1"],
    });
    expect(duplicate.failure).toBe("duplicate");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses another workspace, refreshes only when a refresh token exists, and does not post", async () => {
    configureLinkedIn();
    const session = createConnectionSession({
      provider: "linkedin",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["linkedin:member-sub-1"],
    });
    expect(foreign.failure).toBe("workspace");
    const fetch = vi.mocked(global.fetch);
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("linkedin", "acc_li", {
      accessToken: "old-access",
      providerAccountId: "member-sub-1",
      scopes: ["openid", "profile"],
      tokenType: "bearer",
    });
    const noRefresh = await linkedinConnector.refreshAuth({ id: "acc_li" });
    expect(noRefresh.code).toBe("RECONNECT_REQUIRED");
    expect(fetch).not.toHaveBeenCalled();
    setAccountTokens("linkedin", "acc_li", {
      accessToken: "old-access",
      refreshToken: "old-refresh",
      providerAccountId: "member-sub-1",
      scopes: ["openid", "profile"],
      tokenType: "bearer",
    });
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => tokenPayload({
        access_token: "new-access",
        refresh_token: "new-refresh",
      }),
    });
    const refreshed = await linkedinConnector.refreshAuth({ id: "acc_li" });
    expect(refreshed.ok).toBe(true);
    expect(JSON.stringify(refreshed)).not.toMatch(/new-access|new-refresh|old-refresh|linkedin-client-secret/);
    expect(getAccountTokens("linkedin", "acc_li")).toMatchObject({
      accessToken: "new-access",
      refreshToken: "new-refresh",
      providerAccountId: "member-sub-1",
    });
    expect(String(fetch.mock.calls[0][1].body)).toContain("grant_type=refresh_token");
    expect(String(fetch.mock.calls[0][1].body)).not.toMatch(/ugcPosts|w_member_social/);
    const disconnected = await linkedinConnector.disconnect({ id: "acc_li" });
    expect(disconnected.ok).toBe(true);
    expect(getAccountTokens("linkedin", "acc_li")).toBeNull();
    const blocked = await linkedinConnector.publishContent({ id: "acc_li" }, { text: "hello" });
    expect(blocked.ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });
});
