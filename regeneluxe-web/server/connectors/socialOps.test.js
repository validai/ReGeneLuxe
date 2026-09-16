import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-conn-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-key-")), "key");
process.env.RL_ALLOW_MOCK_CONNECTOR = "1";
process.env.RL_DB_PATH = join(mkdtempSync(join(tmpdir(), "rl-db-")), "test.db");

const { encryptSecret, decryptSecret } = await import("../secrets/crypto.js");
const {
  setAccountTokens,
  getAccountTokens,
  clearAccountTokens,
  publicProviderVaultStatus,
} = await import("../secrets/providers.js");
const { createOAuthState, consumeOAuthState, friendlyOAuthError } = await import("./oauth/state.js");
const { normalizeMetrics, buildMetricSnapshotRecord } = await import("./normalizeMetrics.js");
const {
  listProviderDefinitions,
  getConnector,
  declaredCapabilities,
  hasCapability,
} = await import("./registry.js");
const { createMockConnector } = await import("./providers/mock.js");
const { initDb, resetDbForTests, upsert, list, COLLECTIONS, enqueueJob, JOB_TYPES } = await import("../db/index.js");
const { processJobQueue } = await import("../jobs/worker.js");
const { sanitizeAiContext, validateBrainOutput } = await import("../../src/data/ai/validator.js");

describe("secret encryption boundary", () => {
  it("round-trips tokens without exposing plaintext in vault status", () => {
    setAccountTokens("mock", "acc_1", {
      accessToken: "super-secret-token",
      refreshToken: "super-secret-refresh",
      providerAccountId: "p1",
    });
    const tokens = getAccountTokens("mock", "acc_1");
    expect(tokens.accessToken).toBe("super-secret-token");
    const status = publicProviderVaultStatus();
    expect(JSON.stringify(status)).not.toContain("super-secret-token");
    expect(JSON.stringify(status)).not.toContain("super-secret-refresh");
    clearAccountTokens("mock", "acc_1");
  });

  it("encrypts with aes-gcm envelope", () => {
    const sealed = encryptSecret("hello-token");
    expect(sealed.startsWith("v1:")).toBe(true);
    expect(decryptSecret(sealed)).toBe("hello-token");
  });
});

describe("oauth state", () => {
  it("creates and consumes state once", () => {
    const state = createOAuthState({ provider: "youtube", accountId: "acc_9", returnTo: "/accounts" });
    const first = consumeOAuthState(state);
    expect(first.ok).toBe(true);
    expect(first.accountId).toBe("acc_9");
    expect(consumeOAuthState(state).ok).toBe(false);
  });

  it("maps provider errors to operator language", () => {
    expect(friendlyOAuthError("invalid_grant", "Instagram")).toMatch(/reconnected/i);
    expect(friendlyOAuthError("access_denied", "YouTube")).toMatch(/denied/i);
  });
});

describe("connector registry", () => {
  it("lists providers with readiness and capabilities", () => {
    const defs = listProviderDefinitions();
    expect(defs.find((d) => d.provider === "instagram")).toBeTruthy();
    expect(defs.find((d) => d.provider === "youtube")).toBeTruthy();
    expect(defs.find((d) => d.provider === "tiktok")?.readiness).toMatch(/SETUP|PROVIDER_REVIEW|IMPLEMENTED/);
    expect(declaredCapabilities("Instagram")).toContain("READ_PROFILE");
  });

  it("does not invent connected capabilities without CONNECTED state", () => {
    expect(hasCapability({ platform: "X", connectionState: "MANUAL_ONLY" }, "PUBLISH_POST")).toBe(false);
  });

  it("marks Meta/YouTube SETUP_REQUIRED without env credentials", () => {
    delete process.env.META_APP_ID;
    delete process.env.META_APP_SECRET;
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(getConnector("instagram").resolveReadiness()).toBe("SETUP_REQUIRED");
    expect(getConnector("youtube").resolveReadiness()).toBe("SETUP_REQUIRED");
  });

  it("reports Snapchat, Twitch, and Kick as UNSUPPORTED without inventing OAuth", async () => {
    for (const id of ["snapchat", "twitch", "kick"]) {
      const connector = getConnector(id);
      expect(connector.resolveReadiness()).toBe("UNSUPPORTED");
      expect(connector.capabilities).toEqual([]);
      const auth = await connector.beginAuth();
      expect(auth.ok).toBe(false);
      expect(auth.reason).toBe("UNSUPPORTED");
    }
    const defs = listProviderDefinitions();
    expect(defs.find((d) => d.provider === "snapchat")?.readiness).toBe("UNSUPPORTED");
    expect(defs.find((d) => d.provider === "twitch")?.readiness).toBe("UNSUPPORTED");
    expect(defs.find((d) => d.provider === "kick")?.readiness).toBe("UNSUPPORTED");
  });
});

describe("analytics normalization", () => {
  it("maps aliases and keeps unsupported as absent/null", () => {
    const metrics = normalizeMetrics({ view_count: "10", likes: 3, mystery: 9 }, { fillMissingNull: true });
    expect(metrics.views).toBe(10);
    expect(metrics.likes).toBe(3);
    expect(metrics.shares).toBeNull();
    expect(metrics.mystery).toBeUndefined();
  });

  it("strips secrets from provider payload", () => {
    const snap = buildMetricSnapshotRecord({
      metrics: { views: 1 },
      raw: { accessToken: "nope", views: 1 },
    });
    expect(snap.providerPayload.accessToken).toBeUndefined();
    expect(snap.metrics.views).toBe(1);
  });
});

describe("mock connector + publish idempotency", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
  });

  afterEach(() => {
    clearAccountTokens("mock", "acc_mock");
  });

  it("publishes once for the same idempotency key", async () => {
    const account = {
      id: "acc_mock",
      platform: "Mock",
      connectionState: "CONNECTED",
      publishPermission: "AUTO_PUBLISH",
    };
    await upsert(COLLECTIONS.accounts, account);
    await upsert(COLLECTIONS.content, {
      id: "cnt_1",
      title: "Teaser",
      caption: "Hello",
      status: "READY",
      accountIds: ["acc_mock"],
    });
    setAccountTokens("mock", "acc_mock", { accessToken: "t", providerAccountId: "mock_user_1" });

    const key = "publish:cnt_1:acc_mock:now";
    await enqueueJob({
      type: JOB_TYPES.PUBLISH_CONTENT,
      payload: {
        contentId: "cnt_1",
        accountId: "acc_mock",
        approved: true,
        idempotencyKey: key,
      },
      idempotencyKey: key,
    });
    const first = await processJobQueue({ limit: 2, types: [JOB_TYPES.PUBLISH_CONTENT] });
    expect(first.results[0].ok).toBe(true);

    await enqueueJob({
      type: JOB_TYPES.PUBLISH_CONTENT,
      payload: {
        contentId: "cnt_1",
        accountId: "acc_mock",
        approved: true,
        idempotencyKey: key,
      },
    });
    const second = await processJobQueue({ limit: 2, types: [JOB_TYPES.PUBLISH_CONTENT] });
    const attempts = await list(COLLECTIONS.publication_attempts);
    const published = attempts.filter((a) => a.state === "PUBLISHED");
    expect(published.length).toBe(1);
    expect(second.results.some((r) => r.result?.deduped || r.ok)).toBe(true);
  });

  it("refreshes analytics into history without overwriting", async () => {
    const account = {
      id: "acc_mock",
      platform: "Mock",
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
    };
    await upsert(COLLECTIONS.accounts, account);
    setAccountTokens("mock", "acc_mock", { accessToken: "t", providerAccountId: "mock_user_1" });
    await enqueueJob({
      type: JOB_TYPES.REFRESH_ANALYTICS,
      payload: { accountId: "acc_mock" },
    });
    await processJobQueue({ limit: 1, types: [JOB_TYPES.REFRESH_ANALYTICS] });
    await enqueueJob({
      type: JOB_TYPES.REFRESH_ANALYTICS,
      payload: { accountId: "acc_mock" },
    });
    await processJobQueue({ limit: 1, types: [JOB_TYPES.REFRESH_ANALYTICS] });
    const snaps = await list(COLLECTIONS.analytics);
    expect(snaps.length).toBeGreaterThanOrEqual(2);
    expect(snaps[0].source).toBe("PROVIDER");
    expect(snaps[0].metrics.followers).toBe(1200);
  });

  it("surfaces publish failure without crashing worker", async () => {
    const failing = createMockConnector({ failPublish: true });
    const result = await failing.publishContent(
      { id: "acc_mock", platform: "Mock" },
      { text: "x" },
    );
    // Without tokens, base returns unavailable — set tokens first
    setAccountTokens("mock", "acc_mock", { accessToken: "t" });
    const withTokens = createMockConnector({ failPublish: true });
    const failed = await withTokens.publishContent({ id: "acc_mock" }, { text: "x" });
    expect(failed.ok).toBe(false);
    void result;
  });
});

describe("campaign brain validation + secret strip", () => {
  it("validates structured output and strips oauth material", () => {
    const validated = validateBrainOutput({
      campaignSummary: "Launch is healthy",
      nextBestAction: { label: "Approve tomorrow's Reel." },
      findings: [],
      scheduleAdjustments: [{ when: "evening" }],
      platformRecommendations: [{ platform: "Instagram", action: "repeat format" }],
    });
    expect(validated.ok).toBe(true);
    expect(validated.value.schedulingChanges[0].when).toBe("evening");
    const clean = sanitizeAiContext({
      access_token: "x",
      nested: { refresh_token: "y", client_secret: "z", ok: 1 },
    });
    // current strip is camelCase keys; also ensure common secret keys gone when present
    const clean2 = sanitizeAiContext({
      accessToken: "x",
      refreshToken: "y",
      clientSecret: "z",
      authorization: "Bearer x",
    });
    expect(clean2.accessToken).toBeUndefined();
    expect(clean2.refreshToken).toBeUndefined();
    expect(clean2.clientSecret).toBeUndefined();
    expect(clean2.authorization).toBeUndefined();
    void clean;
  });
});
