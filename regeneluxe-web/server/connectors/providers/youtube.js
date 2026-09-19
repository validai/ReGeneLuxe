import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, envCredentials, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import { readSecrets, writeSecrets } from "../../secrets.js";
import { youtubeCallbackUrl } from "../../auth/origin.js";
import { YOUTUBE_CONNECTION_SCOPE_STRING } from "../../auth/googleScopes.js";
import { friendlyGoogleApiError } from "../../auth/googleErrors.js";

export const youtubeConnector = baseConnector({
  provider: "youtube",
  displayName: "YouTube",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Enable YouTube Data API v3 on the ReGeneLuxe Google Cloud project",
    "2. Enable YouTube Analytics API for watch-time metrics",
    "3. Reuse AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (account login client)",
    `4. Add redirect URI: ${youtubeCallbackUrl()}`,
  ].join("\n"),
  envKeys: {
    clientId: "AUTH_GOOGLE_ID",
    clientSecret: "AUTH_GOOGLE_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.READ_ACCOUNT_METRICS,
    CAPABILITY.READ_CONTENT_METRICS,
  ],
});

youtubeConnector.getAppCredentials = () => {
  const primary = envCredentials("youtube", {
    clientId: "AUTH_GOOGLE_ID",
    clientSecret: "AUTH_GOOGLE_SECRET",
  });
  if (primary.complete) {
    return { ...primary, redirectUri: youtubeCallbackUrl() };
  }
  const fallback = envCredentials("youtube", {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  });
  return { ...fallback, redirectUri: youtubeCallbackUrl() };
};

youtubeConnector.resolveReadiness = () => (
  youtubeConnector.getAppCredentials().complete
    ? PROVIDER_READINESS.IMPLEMENTED
    : PROVIDER_READINESS.SETUP_REQUIRED
);

youtubeConnector._beginAuth = async ({
  accountId,
  returnTo = "/settings",
  managedProfileId,
  operatorId,
  connectionId,
  loginHint = "",
} = {}) => {
  const creds = youtubeConnector.getAppCredentials();
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({
    provider: "youtube",
    accountId,
    returnTo,
    managedProfileId,
    operatorId,
    connectionId: connectionId || accountId,
  });
  const secrets = readSecrets();
  secrets.oauthPkce = secrets.oauthPkce || {};
  secrets.oauthPkce[state] = verifier;
  writeSecrets(secrets);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_CONNECTION_SCOPE_STRING);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return { ok: true, authUrl: url.toString(), state };
};

youtubeConnector._completeAuth = async ({ code, stateMeta, error, errorDescription, state }) => {
  if (error) {
    return {
      ok: false,
      connectionState: "ERROR",
      error: friendlyOAuthError(error, "YouTube"),
      detail: errorDescription || error,
    };
  }
  if (!code) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "YouTube") };
  }
  const creds = youtubeConnector.getAppCredentials();
  const secrets = readSecrets();
  const verifier = secrets.oauthPkce?.[state];
  if (verifier) {
    delete secrets.oauthPkce[state];
    writeSecrets(secrets);
  }

  const body = new URLSearchParams({
    code,
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    redirect_uri: creds.redirectUri,
    grant_type: "authorization_code",
  });
  if (verifier) body.set("code_verifier", verifier);

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "YouTube"),
      detail: tokenJson.error_description || tokenJson.error || "Token exchange failed",
    };
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
    : null;

  const channelsRes = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${tokenJson.access_token}` } },
  );
  const channels = await channelsRes.json().catch(() => ({}));
  if (!channelsRes.ok) {
    const friendly = friendlyGoogleApiError(channels, channelsRes.status, "youtube");
    return { ok: false, ...friendly };
  }
  const items = Array.isArray(channels.items) ? channels.items : [];
  const mapped = items.map(publicYoutubeChannel);
  const channel = mapped[0];

  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const userinfo = await userinfoRes.json().catch(() => ({}));

  setAccountTokens("youtube", stateMeta?.connectionId || stateMeta?.accountId, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt,
    scopes: String(tokenJson.scope || YOUTUBE_CONNECTION_SCOPE_STRING).split(/\s+/),
    providerAccountId: channel?.id || userinfo.sub || null,
  });

  return {
    ok: true,
    connectionState: mapped.length ? "CONNECTED" : "ERROR",
    profile: {
      googleAccountSub: userinfo.sub || "",
      email: userinfo.email || "",
      providerAccountId: channel?.id || null,
      displayName: channel?.title || "",
      handle: channel?.handle || "",
      profileUrl: channel?.profileUrl || "",
      followerCount: channel?.subscriberCount ?? null,
      channels: mapped,
    },
  };
};

export function publicYoutubeChannel(item) {
  const snippet = item?.snippet || {};
  const stats = item?.statistics || {};
  const handle = snippet.customUrl || "";
  return {
    id: item.id,
    title: snippet.title || "",
    handle,
    profileUrl: item.id
      ? (handle ? `https://www.youtube.com/${handle.replace(/^@/, "@")}` : `https://www.youtube.com/channel/${item.id}`)
      : "",
    avatarUrl: snippet.thumbnails?.default?.url || snippet.thumbnails?.medium?.url || "",
    subscriberCount: stats.subscriberCount != null ? Number(stats.subscriberCount) : null,
    videoCount: stats.videoCount != null ? Number(stats.videoCount) : null,
    viewCount: stats.viewCount != null ? Number(stats.viewCount) : null,
  };
}

youtubeConnector._getProfile = async (_account, tokens) => {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "YouTube"),
      detail: json.error?.message,
    };
  }
  const channel = json.items?.[0];
  if (!channel) return unavailable("No YouTube channel on this Google account.");
  return {
    ok: true,
    profile: {
      providerAccountId: channel.id,
      displayName: channel.snippet?.title || "",
      handle: channel.snippet?.customUrl || "",
      profileUrl: `https://www.youtube.com/channel/${channel.id}`,
      followerCount: channel.statistics?.subscriberCount != null
        ? Number(channel.statistics.subscriberCount)
        : null,
      raw: channel,
    },
  };
};

youtubeConnector._getAccountMetrics = async (_account, tokens) => {
  const profile = await youtubeConnector._getProfile(_account, tokens);
  if (!profile.ok) return profile;
  return {
    ok: true,
    metrics: {
      subscribers: profile.profile.followerCount,
      followers: profile.profile.followerCount,
      views: profile.profile.raw?.statistics?.viewCount != null
        ? Number(profile.profile.raw.statistics.viewCount)
        : null,
    },
    source: "PROVIDER",
    capturedAt: new Date().toISOString(),
    providerUpdatedAt: null,
    raw: profile.profile.raw?.statistics || null,
  };
};

youtubeConnector._getContent = async (_account, tokens) => {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/search?part=snippet&forMine=true&type=video&maxResults=25",
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.error?.message || "Failed to list videos." };
  }
  return {
    ok: true,
    items: (json.items || []).map((item) => ({
      providerContentId: item.id?.videoId,
      title: item.snippet?.title,
      publishedAt: item.snippet?.publishedAt,
      raw: item,
    })),
  };
};

youtubeConnector._getContentMetrics = async (_account, contentRef, tokens) => {
  const id = typeof contentRef === "string" ? contentRef : contentRef?.providerContentId;
  if (!id) return unavailable("Video id required.");
  const res = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${tokens.accessToken}` } },
  );
  const json = await res.json().catch(() => ({}));
  const stats = json.items?.[0]?.statistics;
  if (!res.ok || !stats) return { ok: false, error: json.error?.message || "Metrics unavailable." };
  return {
    ok: true,
    metrics: {
      views: stats.viewCount != null ? Number(stats.viewCount) : null,
      likes: stats.likeCount != null ? Number(stats.likeCount) : null,
      comments: stats.commentCount != null ? Number(stats.commentCount) : null,
    },
    source: "PROVIDER",
    capturedAt: new Date().toISOString(),
    raw: stats,
  };
};

youtubeConnector._publishContent = async (_account, payload) => {
  if (!payload?.videoPath && !payload?.mediaUrl) {
    return unavailable("YouTube publishing requires a video file (PUBLISH_VIDEO).");
  }
  return unavailable("Video upload resumable session is ready for wiring once media storage is attached.");
};

youtubeConnector._disconnect = async (account) => {
  clearAccountTokens("youtube", account.id);
  return { ok: true, connectionState: "UNCONNECTED" };
};
