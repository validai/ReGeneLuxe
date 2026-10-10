import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-threads-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-threads-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens } = await import("../secrets/providers.js");
const { peekOAuthState } = await import("./oauth/state.js");
const { threadsConnector } = await import("./providers/threads.js");
const { confirmAccountConnection, startAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { destinationsFromAuthResult } = await import("../../src/data/connectionFlow.js");

const ENV_KEYS = ["THREADS_APP_ID", "THREADS_APP_SECRET", "THREADS_REDIRECT_URI", "META_APP_ID", "META_APP_SECRET", "AUTH_URL"];

describe("threads connection", () => {
  const previous = {};

  beforeEach(async () => {
    vi.stubGlobal("fetch", vi.fn());
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.AUTH_URL = "http://localhost:5174";
    delete process.env.THREADS_APP_ID;
    delete process.env.THREADS_APP_SECRET;
    delete process.env.THREADS_REDIRECT_URI;
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
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

  function configureThreads() {
    process.env.THREADS_APP_ID = "threads-app-id";
    process.env.THREADS_APP_SECRET = "threads-app-secret";
  }

  it("stays setup required until the Threads app id and secret exist", async () => {
    expect(threadsConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    const started = await startAccountConnection({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });

  it("sends localhost, threads_basic, and the Threads app id", async () => {
    configureThreads();
    process.env.THREADS_REDIRECT_URI = "http://127.0.0.1:5174/api/oauth/threads/callback";
    const session = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const started = await threadsConnector.beginAuth({
      accountId: session.id,
      connectionId: session.id,
      operatorId: "opr_1",
      managedProfileId: "prf_1",
      returnTo: `/accounts?connect=select&session=${session.id}`,
    });
    const url = new URL(started.authUrl);
    expect(url.origin).toBe("https://threads.com");
    expect(url.pathname).toBe("/oauth/authorize");
    expect(url.searchParams.get("client_id")).toBe("threads-app-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/threads/callback");
    expect(url.searchParams.get("scope")).toBe("threads_basic");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(started.authUrl).not.toContain("threads-app-secret");
    expect(started.authUrl).not.toContain("meta-app");
    const state = peekOAuthState(url.searchParams.get("state"));
    expect(state.provider).toBe("threads");
    expect(state.accountId).toBe(session.id);
    expect(state.managedProfileId).toBe("prf_1");
    expect(state.operatorId).toBe("opr_1");
  });

  it("exchanges the code, discovers one profile, and keeps the token in the vault", async () => {
    configureThreads();
    const fetch = vi.mocked(global.fetch);
    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short-token", expires_in: 3600 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "long-token", expires_in: 5184000 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: "th_1", username: "djcoast", name: "DJ Coast" }) });
    const auth = await threadsConnector.completeAuth({
      code: "auth-code#_",
      stateMeta: { accountId: "cxs_threads", connectionId: "cxs_threads", managedProfileId: "prf_1" },
    });
    expect(auth.ok).toBe(true);
    expect(auth.profile).toMatchObject({
      providerAccountId: "th_1",
      displayName: "DJ Coast",
      handle: "@djcoast",
      profileUrl: "https://www.threads.net/@djcoast",
    });
    expect(JSON.stringify(auth)).not.toMatch(/short-token|long-token|threads-app-secret|auth-code/);
    expect(String(fetch.mock.calls[0][0])).toBe("https://graph.threads.com/oauth/access_token");
    expect(String(fetch.mock.calls[0][1].body)).toContain("code=auth-code");
    expect(String(fetch.mock.calls[0][1].body)).not.toContain("auth-code%23_");
    expect(String(fetch.mock.calls[1][0])).toContain("https://graph.threads.com/access_token?grant_type=th_exchange_token");
    expect(String(fetch.mock.calls[2][0])).toContain("https://graph.threads.com/v1.0/me?fields=id%2Cusername%2Cname");
    expect(fetch.mock.calls.some((call) => String(call[0]).includes("threads_publish"))).toBe(false);
    const stored = getAccountTokens("threads", "cxs_threads");
    expect(stored.accessToken).toBe("long-token");
    expect(stored.providerAccountId).toBe("th_1");
    expect(stored.scopes).toEqual(["threads_basic"]);
    const destinations = destinationsFromAuthResult("threads", auth);
    expect(destinations).toEqual([expect.objectContaining({
      id: "threads:th_1",
      externalId: "th_1",
      handle: "@djcoast",
      type: "Threads profile",
    })]);
  });

  it("classifies token and profile failures without storing a token", async () => {
    configureThreads();
    const fetch = vi.mocked(global.fetch);
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error_type: "OAuthException", error_message: "Matching code was not found or was already used" }),
    });
    const reconnect = await threadsConnector.completeAuth({ code: "used", stateMeta: { accountId: "cxs_used" } });
    expect(reconnect.code).toBe("RECONNECT_REQUIRED");
    expect(getAccountTokens("threads", "cxs_used")).toBeNull();

    fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ error_message: "Invalid client_id" }),
    });
    const setup = await threadsConnector.completeAuth({ code: "bad", stateMeta: { accountId: "cxs_bad" } });
    expect(setup.code).toBe("SETUP_REQUIRED");

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short-token" }) })
      .mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: { message: "Application does not have permission for this action" } }),
      });
    const permission = await threadsConnector.completeAuth({ code: "perm", stateMeta: { accountId: "cxs_perm" } });
    expect(permission.code).toBe("PERMISSION_MISSING");
    expect(JSON.stringify(permission)).not.toContain("short-token");
    expect(getAccountTokens("threads", "cxs_perm")).toBeNull();

    fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "short-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: "long-token" }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    const none = await threadsConnector.completeAuth({ code: "empty", stateMeta: { accountId: "cxs_empty" } });
    expect(none.code).toBe("NO_DESTINATIONS");
    expect(getAccountTokens("threads", "cxs_empty")).toBeNull();

    fetch.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const provider = await threadsConnector.completeAuth({ code: "down", stateMeta: { accountId: "cxs_down" } });
    expect(provider.code).toBe("PROVIDER_ERROR");
  });

  it("creates a connected approval-required account only after confirmation", async () => {
    const session = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "threads:th_1",
        provider: "threads",
        platform: "Threads",
        name: "DJ Coast",
        handle: "@djcoast",
        type: "Threads profile",
        externalId: "th_1",
        profileUrl: "https://www.threads.net/@djcoast",
      }],
    });
    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("threads", session.id, { accessToken: "long-token", providerAccountId: "th_1", scopes: ["threads_basic"] });
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
      selectedIds: ["threads:th_1"],
    });
    expect(confirmed.created[0]).toMatchObject({
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      providerAccountId: "th_1",
      handle: "@djcoast",
      managedProfileId: "prf_1",
    });
    expect(JSON.stringify(confirmed.created[0])).not.toContain("long-token");
    expect(getAccountTokens("threads", confirmed.created[0].id).accessToken).toBe("long-token");
    expect(getAccountTokens("threads", session.id)).toBeNull();
  });

  it("offers a manual match and blocks a second verified identity", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_manual",
      platform: "Threads",
      displayName: "djcoast",
      handle: "@djcoast",
      connectionState: "MANUAL_ONLY",
      managedProfileId: "prf_1",
      providerAccountId: "",
      publishPermission: "APPROVAL_REQUIRED",
    });
    const session = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const destination = {
      id: "threads:th_1",
      provider: "threads",
      platform: "Threads",
      name: "DJ Coast",
      handle: "@djcoast",
      type: "Threads profile",
      externalId: "th_1",
      profileUrl: "https://www.threads.net/@djcoast",
    };
    updateConnectionSession(session.id, { destinations: [destination] });
    const waiting = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["threads:th_1"],
    });
    expect(waiting.failure).toBe("match");
    expect(waiting.needsChoice[0].accountId).toBe("acc_manual");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);

    const linked = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["threads:th_1"],
      choices: { "threads:th_1": "link" },
    });
    expect(linked.linked[0].id).toBe("acc_manual");
    expect(linked.linked[0].connectionState).toBe("CONNECTED");
    expect(linked.linked[0].providerAccountId).toBe("th_1");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);

    const again = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, { destinations: [destination] });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["threads:th_1"],
    });
    expect(duplicate.failure).toBe("duplicate");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
  });

  it("refuses confirmation from another workspace and disconnects the vault entry", async () => {
    const session = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const foreign = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: ["threads:th_1"],
    });
    expect(foreign.failure).toBe("workspace");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);

    const { setAccountTokens } = await import("../secrets/providers.js");
    setAccountTokens("threads", "acc_th", { accessToken: "long-token", providerAccountId: "th_1" });
    const disconnected = await threadsConnector.disconnect({ id: "acc_th" });
    expect(disconnected.ok).toBe(true);
    expect(getAccountTokens("threads", "acc_th")).toBeNull();
  });
});
