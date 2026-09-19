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
const OPERATOR_EMAIL = MAILBOX;
const ACCOUNT_SUB = "operator-sub";

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
  messages = [{ id: "m1" }],
  messagesStatus = 200,
  messageDetail = {},
  messageDetailStatus = 200,
} = {}) {
  return vi.fn(async (url, init) => {
    const href = String(url);
    if (href.includes("/gmail/v1/users/me/messages/") && href.includes("format=metadata")) {
      expect(href).not.toContain("format=full");
      return jsonResponse(messageDetailStatus, {
        id: "m1",
        threadId: "t1",
        snippet: "hello from the coast",
        internalDate: "1710000000000",
        labelIds: ["INBOX"],
        payload: {
          headers: [
            { name: "From", value: "fan@example.com" },
            { name: "To", value: MAILBOX },
            { name: "Subject", value: "Show tonight" },
            { name: "Date", value: "Wed, 10 Apr 2024 12:00:00 -0400" },
          ],
        },
        ...messageDetail,
      });
    }
    if (href.includes("/gmail/v1/users/me/messages")) {
      expect(decodeURIComponent(href)).toContain("newer_than:30d");
      expect(href).toContain("maxResults=80");
      return jsonResponse(messagesStatus, {
        messages,
        error: messagesStatus >= 400 ? { message: "Gmail API has not been used in project 1 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }] } : undefined,
      });
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
        sub: ACCOUNT_SUB,
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
      googleSub: ACCOUNT_SUB,
      email: OPERATOR_EMAIL,
      name: "Coast Ent",
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

  it("builds a Gmail OAuth start URL with login_hint, consent, and gmail.readonly", async () => {
    const started = await startGmailAuth({ operator, activeProfile: profile });
    expect(started.ok).toBe(true);
    expect(started.managedProfileId).toBe(profile.id);
    expect(started.connectionId).toBeTruthy();
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://accounts.google.com");
    expect(url.searchParams.get("scope")).toBe(GMAIL_CONNECTION_SCOPE_STRING);
    expect(url.searchParams.get("scope")).toContain(GMAIL_READONLY_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("login_hint")).toBe(MAILBOX);
    expect(url.searchParams.get("scope")).not.toMatch(/gmail\.send|gmail\.modify|gmail\.compose/);
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

  it("connects Gmail for the same signed-in Google account", async () => {
    const started = await startGmailAuth({ operator, activeProfile: profile });
    expect(started.ok).toBe(true);
    expect(new URL(started.authUrl).searchParams.get("login_hint")).toBe(MAILBOX);

    vi.stubGlobal("fetch", mockGoogleApis({
      userinfo: { sub: ACCOUNT_SUB, email: MAILBOX },
      profile: { emailAddress: MAILBOX },
    }));
    const result = await completeGmailAuth({
      code: "auth-code",
      state: started.state,
      operator,
    });
    expect(result.ok).toBe(true);
    expect(result.connection.email).toBe(MAILBOX);
    expect(result.connection.email).toBe(operator.email);
    expect(result.connection.managedProfileId).toBe(profile.id);
  });

  it("rejects a mismatched Google identity and does not attach Gmail", async () => {
    const started = await startGmailAuth({ operator, activeProfile: profile });
    vi.stubGlobal("fetch", mockGoogleApis({
      userinfo: { sub: "other-sub", email: "other@gmail.com" },
      profile: { emailAddress: "other@gmail.com" },
    }));
    const result = await completeGmailAuth({
      code: "auth-code",
      state: started.state,
      operator,
    });
    expect(result.ok).toBe(false);
    expect(result.error).toBe("This Google account does not match the ReGeneLuxe account currently signed in.");
    expect(getAccountTokens("gmail", started.connectionId)?.accessToken).toBeFalsy();
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
    expect(result.connection.externalEmail).toBe(MAILBOX);
    const stored = (await list(COLLECTIONS.profile_connections)).find((row) => row.id === result.connection.id);
    expect(stored.googleAccountSub).toBe(ACCOUNT_SUB);
    expect(stored.grantedScopes).toContain(GMAIL_READONLY_SCOPE);
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
    expect(result.error).toMatch(/account/i);
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

  it("indexes a bounded metadata-only Gmail window after connect", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(true);
    expect(result.indexedCount).toBe(1);
    const rows = await list(COLLECTIONS.gmail_messages);
    expect(rows).toHaveLength(1);
    expect(rows[0].managedProfileId).toBe(profile.id);
    expect(rows[0].providerMessageId).toBe("m1");
    expect(rows[0].subject).toBe("Show tonight");
    expect(rows[0].body).toBeUndefined();
    expect(JSON.stringify(rows[0])).not.toContain("gmail-access");
  });

  it("surfaces SETUP REQUIRED when Gmail API is disabled", async () => {
    vi.stubGlobal("fetch", mockGoogleApis({ messagesStatus: 403 }));
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(true);
    expect(result.connectionState).toBe("SETUP_REQUIRED");
    expect(result.connection.lastErrorSummary).toMatch(/Gmail API is not enabled/i);
  });

  it("keeps Gmail isolated to the authorizing profile", async () => {
    vi.stubGlobal("fetch", mockGoogleApis());
    const other = await createManagedProfile(operator.id, { displayName: "Other Act" });
    const started = await startGmailAuth({ operator, activeProfile: profile });
    await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    const otherMail = await list(COLLECTIONS.gmail_messages).then((rows) => rows.filter((row) => row.managedProfileId === other.id));
    expect(otherMail).toHaveLength(0);
    const otherStarted = await startGmailAuth({ operator, activeProfile: other });
    expect(otherStarted.connectionId).not.toBe(started.connectionId);
  });

  it("still persists locally when Turso is unavailable", async () => {
    process.env.TURSO_DATABASE_URL = "https://unavailable.example";
    process.env.TURSO_AUTH_TOKEN = "dead";
    vi.stubGlobal("fetch", mockGoogleApis());
    const started = await startGmailAuth({ operator, activeProfile: profile });
    const result = await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    expect(result.ok).toBe(true);
    expect(result.connection.email).toBe(MAILBOX);
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
  });

  it("indexes metadata only and never stores message bodies", async () => {
    const fetchMock = mockGoogleApis();
    vi.stubGlobal("fetch", fetchMock);
    const started = await startGmailAuth({ operator, activeProfile: profile });
    await completeGmailAuth({ code: "auth-code", state: started.state, operator });
    const urls = fetchMock.mock.calls.map(([url]) => String(url));
    expect(urls.some((item) => item.includes("/users/me/profile"))).toBe(true);
    expect(urls.some((item) => item.includes("/users/me/messages"))).toBe(true);
    expect(urls.some((item) => item.includes("format=full"))).toBe(false);
    const content = await gmailConnector._getContent();
    const messages = await gmailConnector._getMessages();
    expect(content.unavailable).toBe(true);
    expect(messages.unavailable).toBe(true);
  });
});
