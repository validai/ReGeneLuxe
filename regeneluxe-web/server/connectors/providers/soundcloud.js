import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

export const soundcloudConnector = baseConnector({
  provider: "soundcloud",
  displayName: "SoundCloud",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Register a SoundCloud app",
    "2. Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET",
    `3. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/soundcloud/callback`,
  ].join("\n"),
  envKeys: {
    clientId: "SOUNDCLOUD_CLIENT_ID",
    clientSecret: "SOUNDCLOUD_CLIENT_SECRET",
    redirectUri: "SOUNDCLOUD_REDIRECT_URI",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.READ_CONTENT_METRICS,
  ],
});

soundcloudConnector._beginAuth = async ({ accountId, returnTo }) => {
  const creds = soundcloudConnector.getAppCredentials();
  if (!creds.complete) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      instructions: soundcloudConnector.setupInstructions,
      message: "SoundCloud app credentials are not configured.",
    };
  }
  const state = createOAuthState({ provider: "soundcloud", accountId, returnTo });
  const url = new URL("https://soundcloud.com/connect");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "non-expiring");
  url.searchParams.set("state", state);
  return { ok: true, authUrl: url.toString(), state };
};

soundcloudConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError(error, "SoundCloud"), detail: errorDescription };
  }
  if (!code) return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "SoundCloud") };
  const creds = soundcloudConnector.getAppCredentials();
  const tokenRes = await fetch("https://api.soundcloud.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: creds.redirectUri,
      grant_type: "authorization_code",
      code,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "SoundCloud"),
      detail: tokenJson.error_description || tokenJson.error,
    };
  }
  setAccountTokens("soundcloud", stateMeta.accountId, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt: null,
    scopes: [],
  });
  const meRes = await fetch("https://api.soundcloud.com/me", {
    headers: { Authorization: `OAuth ${tokenJson.access_token}` },
  });
  const me = await meRes.json().catch(() => ({}));
  if (me.id) {
    setAccountTokens("soundcloud", stateMeta.accountId, {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      providerAccountId: String(me.id),
    });
  }
  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      providerAccountId: me.id ? String(me.id) : null,
      displayName: me.username || me.full_name || "",
      handle: me.permalink || me.username || "",
      profileUrl: me.permalink_url || "",
      followerCount: me.followers_count ?? null,
      raw: me,
    },
  };
};

soundcloudConnector._getProfile = async (_account, tokens) => {
  const res = await fetch("https://api.soundcloud.com/me", {
    headers: { Authorization: `OAuth ${tokens.accessToken}` },
  });
  const me = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, connectionState: "RECONNECT_REQUIRED", error: friendlyOAuthError("invalid_grant", "SoundCloud") };
  }
  return {
    ok: true,
    profile: {
      providerAccountId: String(me.id),
      displayName: me.username || me.full_name || "",
      handle: me.permalink || "",
      profileUrl: me.permalink_url || "",
      followerCount: me.followers_count ?? null,
      raw: me,
    },
  };
};

soundcloudConnector._getAccountMetrics = async () => unavailable("SoundCloud account metrics limited on current API.");
soundcloudConnector._getContent = async (_account, tokens) => {
  const res = await fetch("https://api.soundcloud.com/me/tracks", {
    headers: { Authorization: `OAuth ${tokens.accessToken}` },
  });
  const json = await res.json().catch(() => ([]));
  if (!res.ok) return { ok: false, error: "Failed to list tracks." };
  const items = Array.isArray(json) ? json : [];
  return {
    ok: true,
    items: items.map((track) => ({
      providerContentId: String(track.id),
      title: track.title,
      publishedAt: track.created_at,
      metrics: {
        streams: track.playback_count ?? null,
        likes: track.favoritings_count ?? track.likes_count ?? null,
        comments: track.comment_count ?? null,
      },
      raw: track,
    })),
  };
};

soundcloudConnector._getContentMetrics = async (_account, contentRef, tokens) => {
  const id = typeof contentRef === "string" ? contentRef : contentRef?.providerContentId;
  if (!id) return unavailable("Track id required.");
  const res = await fetch(`https://api.soundcloud.com/tracks/${id}`, {
    headers: { Authorization: `OAuth ${tokens.accessToken}` },
  });
  const track = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: "Track metrics unavailable." };
  return {
    ok: true,
    metrics: {
      streams: track.playback_count ?? null,
      likes: track.favoritings_count ?? track.likes_count ?? null,
      comments: track.comment_count ?? null,
    },
    source: "PROVIDER",
    capturedAt: new Date().toISOString(),
    raw: track,
  };
};

soundcloudConnector._disconnect = async (account) => {
  clearAccountTokens("soundcloud", account.id);
  return { ok: true, connectionState: "UNCONNECTED" };
};
