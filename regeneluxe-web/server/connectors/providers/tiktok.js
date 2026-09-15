import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

/**
 * TikTok Login Kit / Content Posting API.
 * Many surfaces require additional TikTok developer approval.
 */
export const tiktokConnector = baseConnector({
  provider: "tiktok",
  displayName: "TikTok",
  readiness: PROVIDER_READINESS.PROVIDER_REVIEW_REQUIRED,
  setupInstructions: [
    "1. Create a TikTok developer app at developers.tiktok.com",
    "2. Request Login Kit + Content Posting / Analytics scopes as needed",
    "3. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET",
    `4. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/tiktok/callback`,
  ].join("\n"),
  reviewNotes: "Available after provider approval for Content Posting / Analytics products.",
  envKeys: {
    clientId: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
    redirectUri: "TIKTOK_REDIRECT_URI",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.READ_ACCOUNT_METRICS,
    CAPABILITY.READ_CONTENT_METRICS,
    CAPABILITY.PUBLISH_VIDEO,
  ],
});

tiktokConnector._beginAuth = async ({ accountId, returnTo }) => {
  const status = tiktokConnector.resolveReadiness();
  if (status === "PROVIDER_REVIEW_REQUIRED") {
    // Still allow auth if credentials exist — capabilities may be limited
  }
  const creds = tiktokConnector.getAppCredentials();
  if (!creds.complete) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      message: "TikTok app credentials are not configured.",
      instructions: tiktokConnector.setupInstructions,
    };
  }
  const state = createOAuthState({ provider: "tiktok", accountId, returnTo });
  const url = new URL("https://www.tiktok.com/v2/auth/authorize/");
  url.searchParams.set("client_key", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "user.info.basic,video.list");
  url.searchParams.set("state", state);
  return { ok: true, authUrl: url.toString(), state };
};

tiktokConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    return {
      ok: false,
      connectionState: "ERROR",
      error: friendlyOAuthError(error, "TikTok"),
      detail: errorDescription || error,
    };
  }
  if (!code) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "TikTok") };
  }
  const creds = tiktokConnector.getAppCredentials();
  const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: creds.clientId,
      client_secret: creds.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const data = tokenJson.data || tokenJson;
  if (!tokenRes.ok || !data.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "TikTok"),
      detail: tokenJson.error_description || tokenJson.error || "Token exchange failed",
    };
  }
  setAccountTokens("tiktok", stateMeta.accountId, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || null,
    expiresAt: data.expires_in
      ? new Date(Date.now() + Number(data.expires_in) * 1000).toISOString()
      : null,
    scopes: String(data.scope || "").split(","),
    providerAccountId: data.open_id || null,
  });
  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      providerAccountId: data.open_id || null,
      displayName: "",
      handle: "",
      profileUrl: "",
    },
    note: "Additional TikTok products may remain AVAILABLE AFTER PROVIDER APPROVAL.",
  };
};

tiktokConnector._getProfile = async (_account, tokens) => {
  const res = await fetch("https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  const user = json.data?.user || json.data || {};
  if (!res.ok) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "TikTok"),
    };
  }
  return {
    ok: true,
    profile: {
      providerAccountId: user.open_id || tokens.providerAccountId,
      displayName: user.display_name || "",
      handle: user.display_name || "",
      profileUrl: "",
      raw: user,
    },
  };
};

tiktokConnector._getAccountMetrics = async () => unavailable("TikTok analytics available after provider approval.");
tiktokConnector._getContent = async () => unavailable("TikTok video list available after provider approval for video.list.");
tiktokConnector._getContentMetrics = async () => unavailable("TikTok content metrics available after provider approval.");
tiktokConnector._publishContent = async () => unavailable("TikTok publishing available after provider approval.");
tiktokConnector._disconnect = async (account) => {
  clearAccountTokens("tiktok", account.id);
  return { ok: true, connectionState: "UNCONNECTED" };
};
