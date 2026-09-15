import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector } from "../base.js";
import { setAccountTokens, clearAccountTokens } from "../../secrets/providers.js";

/**
 * Test-only mock connector. Never registered in production UI registry
 * unless RL_ALLOW_MOCK_CONNECTOR=1.
 */
export function createMockConnector({
  failPublish = false,
  failMetrics = false,
  rateLimited = false,
} = {}) {
  const connector = baseConnector({
    provider: "mock",
    displayName: "Mock",
    readiness: PROVIDER_READINESS.IMPLEMENTED,
    setupInstructions: "Test only.",
    envKeys: {},
    capabilities: [
      CAPABILITY.READ_PROFILE,
      CAPABILITY.READ_CONTENT,
      CAPABILITY.READ_ACCOUNT_METRICS,
      CAPABILITY.READ_CONTENT_METRICS,
      CAPABILITY.READ_COMMENTS,
      CAPABILITY.PUBLISH_TEXT,
      CAPABILITY.PUBLISH_IMAGE,
      CAPABILITY.SCHEDULE,
    ],
  });

  connector.resolveReadiness = () => PROVIDER_READINESS.IMPLEMENTED;
  connector.getAppCredentials = () => ({
    complete: true,
    clientId: "mock",
    clientSecret: "mock",
    redirectUri: "http://127.0.0.1/callback",
    source: "mock",
  });

  connector._beginAuth = async ({ accountId }) => ({
    ok: true,
    authUrl: `http://127.0.0.1:5174/api/oauth/mock/callback?code=mock-code&state=test&accountId=${accountId}`,
    state: "test",
  });

  connector._completeAuth = async ({ stateMeta }) => {
    setAccountTokens("mock", stateMeta.accountId, {
      accessToken: "mock-access-token",
      refreshToken: "mock-refresh-token",
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      scopes: ["all"],
      providerAccountId: "mock_user_1",
    });
    return {
      ok: true,
      connectionState: "CONNECTED",
      profile: {
        providerAccountId: "mock_user_1",
        displayName: "Mock Artist",
        handle: "@mock",
        profileUrl: "https://example.com/mock",
        followerCount: 1200,
      },
    };
  };

  connector._getProfile = async () => ({
    ok: true,
    profile: {
      providerAccountId: "mock_user_1",
      displayName: "Mock Artist",
      handle: "@mock",
      profileUrl: "https://example.com/mock",
      followerCount: 1200,
    },
  });

  connector._getAccountMetrics = async () => {
    if (rateLimited) return { ok: false, error: "rate_limited", retryAfterSeconds: 60 };
    if (failMetrics) return { ok: false, error: "metrics_unavailable" };
    return {
      ok: true,
      metrics: {
        followers: 1200,
        followersGained: 12,
        impressions: 5400,
        reach: 4100,
        engagementRate: 0.042,
      },
      source: "PROVIDER",
      capturedAt: new Date().toISOString(),
      providerUpdatedAt: new Date().toISOString(),
    };
  };

  connector._getContent = async () => ({
    ok: true,
    items: [
      {
        providerContentId: "mock_post_1",
        title: "Launch teaser",
        publishedAt: new Date().toISOString(),
        metrics: { views: 900, likes: 40, comments: 3 },
      },
    ],
  });

  connector._getContentMetrics = async (_a, contentRef) => ({
    ok: true,
    metrics: {
      views: 900,
      likes: 40,
      comments: 3,
      shares: null,
      saves: null,
    },
    source: "PROVIDER",
    capturedAt: new Date().toISOString(),
    providerContentId: typeof contentRef === "string" ? contentRef : contentRef?.providerContentId,
  });

  connector._publishContent = async (_a, payload) => {
    if (failPublish) return { ok: false, error: "publish_failed" };
    return {
      ok: true,
      providerPostId: `mock_pub_${Date.now()}`,
      raw: { text: payload?.text || payload?.caption || "" },
    };
  };

  connector._getComments = async () => ({
    ok: true,
    items: [
      {
        id: "mock_c1",
        sender: "fan1",
        message: "This slap",
        timestamp: new Date().toISOString(),
        type: "comment",
      },
    ],
  });

  connector._disconnect = async (account) => {
    clearAccountTokens("mock", account.id);
    return { ok: true, connectionState: "UNCONNECTED" };
  };

  return connector;
}
