import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GMAIL_READONLY_SCOPE, GMAIL_CONNECTION_SCOPE_STRING, OPERATOR_GOOGLE_SCOPES } from "../auth/googleScopes.js";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-gmail-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-gmail-key-")), "key");
process.env.RL_DB_MODE = "memory";
process.env.AUTH_GOOGLE_ID = "test-google-client";
process.env.AUTH_GOOGLE_SECRET = "test-google-secret";
process.env.AUTH_URL = "http://127.0.0.1:5174";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { gmailConnector } = await import("./providers/gmail.js");
const { consumeOAuthState } = await import("./oauth/state.js");
const {
  setAccountTokens,
  getAccountTokens,
  publicProviderVaultStatus,
} = await import("../secrets/providers.js");
const { initDb, resetDbForTests, closeDb, upsert, list, COLLECTIONS } = await import("../db/index.js");
const { createManagedProfile } = await import("../db/managedProfileRepository.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const {
  startGmailAuth,
  completeGmailAuth,
  refreshGmailConnection,
  disconnectGmailConnection,
  connectionRowExposesSecrets,
  listCampaignsForProfile,
} = await import("./gmailConnection.js");
const { publicProfileConnection } = await import("../../src/data/profileModels.js");
const { stripSecretFields } = await import("../../src/data/secretFields.js");
const { sanitizeAiContext } = await import("../../src/data/ai/validator.js");
const { exportDatabaseSnapshot } = await import("../db/backup.js");

const MAILBOX = "djcoast239@gmail.com";

function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function mockGoogleApis({
  token = {},
  tokenStatus = 200,
  userinfo = {},
  userinfoStatus = 200,
  profile = {},
  profileStatus = 200,
  refreshStatus = 200,
  refreshToken = {},
} = {}) {
  return vi.fn(async (url, init) => {
    const href = String(url);
    if (href.includes("/gmail/v1/users/me/messages")) {
      throw new Error("messages must not be fetched in connection v1");
    }
    if (href.includes("oauth2.googleapis.com/token")) {
      const raw = init?.body;
      const params = raw instanceof URLSearchParams ? raw : new URLSearchParams(String(raw || ""));
      if (params.get("grant_type") === "refresh_token") {
        return jsonResponse(refreshStatus, {
          access_token: "new-access",
          expires_in: 3600,
          scope: GMAIL_CONNECTION_SCOPE_STRING,
          ...refreshToken,
        });
      }
      expect(params.get("grant_type")).toBe("authorization_code");
      expect(params.get("redirect_uri")).toBe("http://127.0.0.1:5174/api/oauth/gmail/callback");
      expect(params.get("redirect_uri")).not.toContain("/api/auth/callback/google");
      return jsonResponse(tokenStatus, {
        access_token: "gmail-access",
        refresh_token: "gmail-refresh",
        expires_in: 3600,
        scope: GMAIL_CONNECTION_SCOPE_STRING,
        ...token,
      });
    }
    if (href.includes("oauth2.googleapis.com/revoke")) {
      return jsonResponse(200, {});
    }
    if (href.includes("oauth2/v3/userinfo")) {
      return jsonResponse(userinfoStatus, {
        sub: "mailbox-sub-1",
        email: MAILBOX,
        ...userinfo,
      });
    }
    if (href.includes("/gmail/v1/users/me/profile")) {
      return jsonResponse(profileStatus, {
        emailAddress: MAILBOX,
        messagesTotal: 12,
        threadsTotal: 4,
        historyId: "888",
        ...profile,
      });
    }
    throw new Error(`unexpected fetch ${href}`);
  });
}

describe("gmail connection v1", () => {
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
      email: "validsstudio@gmail.com",
      name: "Operator",
    });
    profile = await createManagedProfile(operator.id, {
      displayName: "DJ Coast",
      primaryEmail: MAILBOX,
    });
    vi.unstubAllGlobals();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await closeDb();
  });

  it("builds a Gmail OAuth start URL with account chooser, offline access, and gmail.readonly", async () => {
    const started = await startGmailAuth({ operator, activeProfile: profile });
    expect(started.ok).toBe(true);
    expect(started.managedProfileId).toBe(profile.id);
    expect(started.connectionId).toBeTruthy();
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_CONNECTION_SCOPE_STRING);
    expect(url.searchParams.get("scope")).toContain(GMAIL_READONLY_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent select_account");
    expect(url.searchParams.get("login_hint")).toBeNull();
    expect(url.searchParams.get("redirect_uri")).toBe("http://127.0.0.1:5174/api/oauth/gmail/callback");
    expect(url.searchParams.get("redirect_uri")).not.toContain("/api/auth/callback/google");
    expect(OPERATOR_GOOGLE_SCOPES).not.toContain("gmail");
    const state = consumeOAuthState(started.state);
    expect(state.ok).toBe(true);
    expect(state.managedProfileId).toBe(profile.id);
    expect(state.operatorId).toBe(operator.id);
    expect(state.provider).toBe("gmail");
    expect(consumeOAuthState(started.state).ok).toBe(false);
  });

  it("scopes the connection to the authorizing managed profile, not the operator", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({
      code: "auth-code",
      state: started.state,
      operator,
    });
    expect(result.ok).toBe(true);
    expect(result.connectionState).toBe("CONNECTED");
    expect(result.connection.managedProfileId).toBe(profile.id);
    expect(result.connection.email).toBe(MAILBOX);
    expect(result.connection.googleAccountSub).toBe("mailbox-sub-1");
    expect(result.connection.grantedScopes).toContain(GMAIL_READONLY_SCOPE);
    expect(JSON.stringify(result.connection)).not.toContain("gmail-access");
    expect(JSON.stringify(result.connection)).not.toContain("gmail-refresh");
    expect(result.connection.managedProfileId).not.toBe(operator.id);
  });

  it("rejects callback state bound to a different operator", async () => {
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const stranger = await upsertOperatorFromGoogle({
      googleSub: "stranger-sub",
      email: "other@example.com",
      name: "Other",
    });
    const result = await completeGmailAuth({
      code: "auth-code",
      state: started.state,
      operator: stranger,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/operator/i);
  });

  it("stores tokens only in the encrypted vault", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    const tokens = getAccountTokens("gmail", result.connection.id);
    expect(tokens.accessToken).toBe("gmail-access");
    expect(tokens.refreshToken).toBe("gmail-refresh");
    const status = publicProviderVaultStatus();
    expect(JSON.stringify(status)).not.toContain("gmail-access");
    expect(JSON.stringify(status)).not.toContain("gmail-refresh");
    const rows = await list(COLLECTIONS.profile_connections);
    const gmailRow = rows.find((row) => row.kind === "GMAIL" && row.managedProfileId === profile.id);
    expect(connectionRowExposesSecrets(gmailRow)).toBe(false);
    expect(gmailRow.email).toBe(MAILBOX);
    expect(gmailRow.mailbox.historyId).toBe("888");
    expect(gmailRow.accessToken).toBeUndefined();
    const snapshot = await exportDatabaseSnapshot();
    expect(JSON.stringify(snapshot)).not.toContain("gmail-access");
    expect(JSON.stringify(snapshot)).not.toContain("gmail-refresh");
  });

  it("does not mark CONNECTED when Gmail users.getProfile fails", async () => {
    vi.stubGlobal("fetch", mockGoogleApis({ profileStatus: 401, profile: { error: { message: "invalid" } } }));
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(false);
    expect(result.connectionState).not.toBe("CONNECTED");
    expect(getAccountTokens("gmail", started.connectionId)?.accessToken).toBeFalsy();
  });

  it("does not mark CONNECTED when gmail.readonly is missing from granted scopes", async () => {
    vi.stubGlobal("fetch", mockGoogleApis({ token: { scope: "openid email profile" } }));
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/gmail.readonly/i);
  });

  it("rejects expired or missing OAuth state", async () => {
    const missing = await completeGmailAuth({ code: "x", state: "", operator });
    expect(missing.ok).toBe(false);
    const forged = await completeGmailAuth({ code: "x", state: "nope", operator });
    expect(forged.ok).toBe(false);
  });

  it("marks reconnect required when refresh fails", async () => {
    vi.stubGlobal("fetch", mockGoogleApis({
      refreshStatus: 400,
      refreshToken: { error: "invalid_grant" },
    }));
    const started = await startGmailAuth({ operator, activeProfile: profile });
    setAccountTokens("gmail", started.connectionId, {
      accessToken: "old",
      refreshToken: "dead-refresh",
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      scopes: [GMAIL_READONLY_SCOPE],
    });
    await upsert(COLLECTIONS.profile_connections, {
      ...(await list(COLLECTIONS.profile_connections)).find((row) => row.id === started.connectionId),
      status: "CONNECTED",
      connectionState: "CONNECTED",
      email: MAILBOX,
    });
    const refreshed = await refreshGmailConnection({ operator, activeProfile: profile });
    expect(refreshed.ok).toBe(false);
    expect(refreshed.connectionState).toBe("RECONNECT_REQUIRED");
  });

  it("verifies the mailbox again on a successful refresh", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    const refreshed = await refreshGmailConnection({ operator, activeProfile: profile });
    expect(refreshed.ok).toBe(true);
    expect(refreshed.connectionState).toBe("CONNECTED");
    expect(refreshed.connection.email).toBe(MAILBOX);
  });

  it("disconnects Gmail without deleting the managed profile or campaigns", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_keep",
      name: "Keep me",
      managedProfileId: profile.id,
    });
    const disconnected = await disconnectGmailConnection({ operator, activeProfile: profile });
    expect(disconnected.ok).toBe(true);
    expect(disconnected.connectionState).toBe("NOT_CONNECTED");
    expect(disconnected.profilePreserved).toBe(true);
    expect(getAccountTokens("gmail", started.connectionId)?.accessToken).toBeFalsy();
    const campaigns = await listCampaignsForProfile(profile.id);
    expect(campaigns.map((row) => row.id)).toContain("camp_keep");
    const still = await list(COLLECTIONS.managed_profiles);
    expect(still.find((row) => row.id === profile.id)?.displayName).toBe("DJ Coast");
  });

  it("strips Gmail tokens from backups, public rows, and Campaign Brain context", () => {
    const publicRow = publicProfileConnection({
      id: "pcn_1",
      managedProfileId: profile.id,
      kind: "GMAIL",
      status: "CONNECTED",
      email: MAILBOX,
      accessToken: "nope",
      refreshToken: "nope2",
    });
    expect(publicRow.accessToken).toBeUndefined();
    expect(publicRow.refreshToken).toBeUndefined();
    expect(stripSecretFields({ accessToken: "x", email: MAILBOX }).accessToken).toBeUndefined();
    const brain = sanitizeAiContext({
      gmail: { accessToken: "tok", refreshToken: "ref", email: MAILBOX },
    });
    expect(brain.gmail.accessToken).toBeUndefined();
    expect(brain.gmail.refreshToken).toBeUndefined();
    expect(brain.gmail.email).toBe(MAILBOX);
  });

  it("does not ingest messages while verifying the mailbox", async () => {
    const fetchMock = mockGoogleApis();
    vi.stubGlobal("fetch", fetchMock);
    const started = await startGmailAuth({ operator, activeProfile: profile });
    await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((item) => item.includes("/users/me/profile"))).toBe(true);
    expect(urls.some((item) => item.includes("/users/me/messages"))).toBe(false);
    const content = await gmailConnector._getContent();
    const messages = await gmailConnector._getMessages();
    expect(content.unavailable).toBe(true);
    expect(messages.unavailable).toBe(true);
  });
});
