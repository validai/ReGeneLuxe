import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import { readSecrets, writeSecrets } from "../../secrets.js";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
].join(" ");

export const youtubeConnector = baseConnector({
  provider: "youtube",
  displayName: "YouTube",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create a Google Cloud project and enable YouTube Data API v3 (+ Analytics if needed)",
    "2. Configure OAuth consent and create OAuth client credentials",
    "3. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
    `4. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/youtube/callback`,
  ].join("\n"),
  envKeys: {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
    redirectUri: "GOOGLE_REDIRECT_URI",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.READ_ACCOUNT_METRICS,
    CAPABILITY.READ_CONTENT_METRICS,
    CAPABILITY.READ_COMMENTS,
    CAPABILITY.PUBLISH_VIDEO,
  ],
});

youtubeConnector._beginAuth = async ({ accountId, returnTo, loginHint = "" }) => {
  const creds = youtubeConnector.getAppCredentials();
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({ provider: "youtube", accountId, returnTo });
  const secrets = readSecrets();
  secrets.oauthPkce = secrets.oauthPkce || {};
  secrets.oauthPkce[state] = verifier;
  writeSecrets(secrets);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
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
  const channel = channels.items?.[0];

  setAccountTokens("youtube", stateMeta.accountId, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt,
    scopes: String(tokenJson.scope || SCOPES).split(/\s+/),
    providerAccountId: channel?.id || null,
  });

  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      providerAccountId: channel?.id || null,
      displayName: channel?.snippet?.title || "",
      handle: channel?.snippet?.customUrl || channel?.snippet?.title || "",
      profileUrl: channel?.id ? `https://www.youtube.com/channel/${channel.id}` : "",
      followerCount: channel?.statistics?.subscriberCount != null
        ? Number(channel.statistics.subscriberCount)
        : null,
      raw: channel || null,
    },
  };
};

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
