import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { assertPublicProviderMedia } from "../../../src/data/mediaReadiness.js";
import { baseConnector, defaultRedirect, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import {
  META_PILOT_SCOPES,
  destinationsForSurface,
  metaDialogUrl,
  metaGraphUrl,
  publicDestinationsFromPages,
  publishFacebookPagePost,
  publishInstagramMedia,
  safeProviderError,
} from "./metaGraph.js";

/**
 * Meta Facebook Login for Instagram professional accounts and Facebook Pages.
 * Requires META_APP_ID, META_APP_SECRET, and optional META_GRAPH_VERSION / META_REDIRECT_URI.
 * A grant is not CONNECTED until the operator selects a discovered destination.
 */
export function createMetaConnector({ surface = "instagram" } = {}) {
  const provider = surface === "facebook" ? "facebook" : "instagram";
  const displayName = surface === "facebook" ? "Facebook" : "Instagram";

  const connector = baseConnector({
    provider,
    displayName,
    readiness: PROVIDER_READINESS.IMPLEMENTED,
    setupInstructions: [
      "1. Create a Meta app at developers.facebook.com and add Facebook Login.",
      "2. Add the Instagram product if you will publish to a professional Instagram account.",
      "3. Set META_APP_ID and META_APP_SECRET on the server. Optional: META_REDIRECT_URI and META_GRAPH_VERSION.",
      `4. Add this redirect URI in the Meta app: ${canonicalOAuthRedirect(process.env.META_REDIRECT_URI) || defaultRedirect(provider)}`,
      "5. Use a Facebook user who manages a Page. Instagram must be a professional account linked to that Page.",
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
      CAPABILITY.PUBLISH_IMAGE,
      CAPABILITY.PUBLISH_VIDEO,
      CAPABILITY.PUBLISH_TEXT,
    ],
  });

  connector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null }) => {
    const creds = connector.getAppCredentials();
    const state = createOAuthState({ provider, accountId, returnTo, operatorId, managedProfileId });
    const url = new URL(metaDialogUrl());
    url.searchParams.set("client_id", creds.clientId);
    url.searchParams.set("redirect_uri", creds.redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", META_PILOT_SCOPES.join(","));
    url.searchParams.set("response_type", "code");
    return { ok: true, authUrl: url.toString(), state };
  };

  connector._completeAuth = async ({ code, stateMeta, error }) => {
    if (error) {
      return {
        ok: false,
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: friendlyOAuthError(error, displayName),
      };
    }
    if (!code) {
      return { ok: false, connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", displayName) };
    }
    const creds = connector.getAppCredentials();
    const tokenUrl = new URL(metaGraphUrl("/oauth/access_token"));
    tokenUrl.searchParams.set("client_id", creds.clientId);
    tokenUrl.searchParams.set("client_secret", creds.clientSecret);
    tokenUrl.searchParams.set("redirect_uri", creds.redirectUri);
    tokenUrl.searchParams.set("code", code);
    const tokenRes = await fetch(tokenUrl);
    const tokenJson = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokenJson.access_token) {
      return {
        ok: false,
        connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
        error: friendlyOAuthError("invalid_grant", displayName),
      };
    }

    const longUrl = new URL(metaGraphUrl("/oauth/access_token"));
    longUrl.searchParams.set("grant_type", "fb_exchange_token");
    longUrl.searchParams.set("client_id", creds.clientId);
    longUrl.searchParams.set("client_secret", creds.clientSecret);
    longUrl.searchParams.set("fb_exchange_token", tokenJson.access_token);
    const longRes = await fetch(longUrl);
    const longJson = await longRes.json().catch(() => ({}));
    const accessToken = longJson.access_token || tokenJson.access_token;
    const expiresIn = Number(longJson.expires_in || tokenJson.expires_in || 0);

    const pagesUrl = new URL(metaGraphUrl("/me/accounts"));
    pagesUrl.searchParams.set("fields", "id,name,tasks,access_token,instagram_business_account{id,username}");
    pagesUrl.searchParams.set("access_token", accessToken);
    const pagesRes = await fetch(pagesUrl);
    const pagesJson = await pagesRes.json().catch(() => ({}));
    if (!pagesRes.ok) {
      return {
        ok: false,
        connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
        error: safeProviderError(pagesJson.error?.message || `${displayName} needs to be reconnected.`),
      };
    }

    const discovered = destinationsForSurface(publicDestinationsFromPages(pagesJson.data || []), surface);
    setAccountTokens(provider, stateMeta.accountId, {
      accessToken,
      refreshToken: null,
      expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      scopes: [...META_PILOT_SCOPES],
      providerAccountId: null,
      pages: pagesJson.data || [],
    });

    if (!discovered.length) {
      return {
        ok: false,
        connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
        error: surface === "instagram"
          ? "No professional Instagram account is linked to a Page you manage."
          : "No Facebook Page is available on this authorization.",
      };
    }

    return {
      ok: true,
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      pendingSelection: true,
      pendingDestinations: discovered,
      profile: {
        pendingDestinations: discovered,
        displayName: "",
        handle: "",
      },
    };
  };

  connector._getProfile = async (account) => {
    if (!account?.providerAccountId) {
      return unavailable("Select a Page or Instagram professional account before this connection is verified.");
    }
    return {
      ok: true,
      profile: {
        providerAccountId: account.providerAccountId,
        displayName: account.displayName || "",
        handle: account.handle || "",
        profileUrl: account.profileUrl || "",
        pageId: account.pageId || "",
        pageName: account.pageName || "",
      },
    };
  };

  connector._getAccountMetrics = async () => unavailable("Insights are not part of this pilot.");
  connector._getContent = async () => unavailable("Content import is not part of this pilot.");
  connector._getContentMetrics = async () => unavailable("Content metrics are not part of this pilot.");

  connector._publishContent = async (account, payload, tokens) => {
    if (surface === "facebook") {
      const message = payload?.caption || payload?.text || "";
      if (!message) return unavailable("Facebook Page publishing requires text.");
      const page = (tokens.pages || []).find((item) => String(item.id) === String(account.pageId || account.providerAccountId));
      if (!page?.access_token) return unavailable("The Page token is missing. Select the Page again.");
      return publishFacebookPagePost({
        pageId: page.id,
        pageAccessToken: page.access_token,
        message,
      });
    }
    const mediaUrl = payload?.imageUrl || payload?.mediaUrl || "";
    const videoUrl = payload?.videoUrl || "";
    const check = assertPublicProviderMedia(videoUrl || mediaUrl);
    if (!check.ok) return { ok: false, error: "MEDIA_PUBLIC_URL_REQUIRED", code: "MEDIA_PUBLIC_URL_REQUIRED" };
    if (!account?.providerAccountId) return unavailable("Select an Instagram professional account before publishing.");
    const page = (tokens.pages || []).find((item) => String(item.instagram_business_account?.id) === String(account.providerAccountId));
    return publishInstagramMedia({
      igUserId: account.providerAccountId,
      accessToken: page?.access_token || tokens.accessToken,
      imageUrl: videoUrl ? "" : mediaUrl,
      videoUrl,
    });
  };

  connector._disconnect = async (account) => {
    clearAccountTokens(provider, account.id);
    return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
  };

  return connector;
}

export const instagramConnector = createMetaConnector({ surface: "instagram" });
export const facebookConnector = createMetaConnector({ surface: "facebook" });
