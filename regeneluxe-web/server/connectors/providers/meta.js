import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import {
  clearAccountTokens,
  setAccountTokens,
} from "../../secrets/providers.js";

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "instagram_manage_comments",
].join(",");

/**
 * Meta Graph — Instagram professional + Facebook Pages.
 * Requires META_APP_ID + META_APP_SECRET (or secrets vault).
 */
export function createMetaConnector({ surface = "instagram" } = {}) {
  const provider = surface === "facebook" ? "facebook" : "instagram";
  const displayName = surface === "facebook" ? "Facebook" : "Instagram";

  const connector = baseConnector({
    provider,
    displayName,
    readiness: PROVIDER_READINESS.IMPLEMENTED,
    setupInstructions: [
      "1. Create a Meta app at developers.facebook.com",
      "2. Add Instagram Graph / Facebook Login products",
      "3. Set META_APP_ID and META_APP_SECRET (or Settings → provider secrets)",
      `4. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/${provider}/callback`,
      "5. Use a professional Instagram account linked to a Facebook Page",
    ].join("\n"),
    envKeys: {
      clientId: "META_APP_ID",
      clientSecret: "META_APP_SECRET",
      redirectUri: "META_REDIRECT_URI",
    },
    capabilities: [
      CAPABILITY.READ_PROFILE,
      CAPABILITY.READ_CONTENT,
      CAPABILITY.READ_ACCOUNT_METRICS,
      CAPABILITY.READ_CONTENT_METRICS,
      CAPABILITY.READ_COMMENTS,
      CAPABILITY.PUBLISH_IMAGE,
      CAPABILITY.PUBLISH_VIDEO,
      CAPABILITY.SCHEDULE,
      CAPABILITY.DELETE_CONTENT,
    ],
  });

  connector._beginAuth = async ({ accountId, returnTo }) => {
    const creds = connector.getAppCredentials();
    const state = createOAuthState({ provider, accountId, returnTo });
    const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", creds.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", SCOPES);
    url.searchParams.set("response_type", "code");
    return { ok: true, authUrl: url.toString(), state };
  };

  connector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
    if (error) {
      return {
        ok: false,
        connectionState: "ERROR",
        error: friendlyOAuthError(error, displayName),
        detail: errorDescription || error,
      };
    }
    if (!code) {
      return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", displayName) };
    }
    const creds = connector.getAppCredentials();
    const tokenUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", creds.clientId);
    tokenUrl.searchParams.set("client_secret", creds.clientSecret);
    tokenUrl.searchParams.set("redirect_uri", creds.redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl);
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return {
        ok: false,
        connectionState: "RECONNECT_REQUIRED",
        error: friendlyOAuthError(tokenJson.error?.code || "invalid_grant", displayName),
        detail: tokenJson.error?.message || "Token exchange failed",
      };
    }

    // Exchange for long-lived user token
    const longUrl = new URL("https://graph.facebook.com/v21.0/oauth/access_token");
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", creds.clientId);
    longUrl.searchParams.set("client_secret", creds.clientSecret);
    longUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
    const longRes = await fetch(longUrl);
    const longJson = await longRes.json().catch(() => ({}));
    const accessToken = longJson.access_token || tokenJson.access_token;
    const expiresIn = Number(longJson.expires_in || tokenJson.expires_in || 0);
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : null;

    const meRes = await fetch(`https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(accessToken)}`);
    const me = await meRes.json().catch(() => ({}));

    setAccountTokens(provider, stateMeta.accountId, {
      accessToken,
      refreshToken: null,
      expiresAt,
      scopes: SCOPES.split(","),
      providerAccountId: me.id || null,
    });

    return {
      ok: true,
      connectionState: "CONNECTED",
      profile: {
        providerAccountId: me.id || null,
        displayName: me.name || "",
        handle: me.name || "",
        profileUrl: "",
      },
    };
  };

  connector._getProfile = async (account, tokens) => {
    const res = await fetch(
      `https://graph.facebook.com/v21.0/me?fields=id,name&access_token=${encodeURIComponent(tokens.accessToken)}`,
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        ok: false,
        connectionState: "RECONNECT_REQUIRED",
        error: friendlyOAuthError("invalid_grant", displayName),
        detail: json.error?.message,
      };
    }
    return {
      ok: true,
      profile: {
        providerAccountId: json.id,
        displayName: json.name,
        handle: account.handle || json.name,
        profileUrl: account.profileUrl || "",
        raw: json,
      },
    };
  };

  connector._getAccountMetrics = async (_account, tokens) => {
    // Insights require a Page/IG user id — return honest empty when only user token known
    if (!tokens.providerAccountId) {
      return unavailable("Connect a Page / Instagram professional account to read metrics.");
    }
    return {
      ok: true,
      metrics: {
        followers: null,
        impressions: null,
        reach: null,
      },
      source: "PROVIDER",
      note: "Request Page/IG insights with the linked professional asset id.",
      capturedAt: new Date().toISOString(),
      raw: null,
    };
  };

  connector._getContent = async () => unavailable("Content import requires a linked Instagram business / Page id.");
  connector._getContentMetrics = async () => unavailable("Content metrics require a linked media id.");

  connector._publishContent = async (_account, payload, tokens) => {
    if (!payload?.mediaUrl && !payload?.imageUrl) {
      return unavailable("Instagram publishing requires an image or video URL (PUBLISH_IMAGE / PUBLISH_VIDEO).");
    }
    // Container publish needs IG user id — honest failure until selected
    if (!tokens.providerAccountId) {
      return unavailable("Select an Instagram professional account before publishing.");
    }
    return unavailable("Publishing via Graph API requires IG user container flow — configure professional asset first.");
  };

  connector._disconnect = async (account) => {
    clearAccountTokens(provider, account.id);
    return { ok: true, connectionState: "UNCONNECTED" };
  };

  return connector;
}

export const instagramConnector = createMetaConnector({ surface: "instagram" });
export const facebookConnector = createMetaConnector({ surface: "facebook" });
