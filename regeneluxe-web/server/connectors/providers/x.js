import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import { readSecrets, writeSecrets } from "../../secrets.js";

export const xConnector = baseConnector({
  provider: "x",
  displayName: "X",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create an X developer app with OAuth 2.0",
    "2. Set X_CLIENT_ID and X_CLIENT_SECRET",
    `3. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/x/callback`,
  ].join("\n"),
  envKeys: {
    clientId: "X_CLIENT_ID",
    clientSecret: "X_CLIENT_SECRET",
    redirectUri: "X_REDIRECT_URI",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.READ_ACCOUNT_METRICS,
    CAPABILITY.READ_CONTENT_METRICS,
    CAPABILITY.READ_MENTIONS,
    CAPABILITY.PUBLISH_TEXT,
    CAPABILITY.PUBLISH_IMAGE,
  ],
});

xConnector._beginAuth = async ({ accountId, returnTo }) => {
  const creds = xConnector.getAppCredentials();
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({ provider: "x", accountId, returnTo });
  const secrets = readSecrets();
  secrets.oauthPkce = secrets.oauthPkce || {};
  secrets.oauthPkce[state] = verifier;
  writeSecrets(secrets);
  const url = new URL("https://twitter.com/i/oauth2/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", "tweet.read tweet.write users.read offline.access");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { ok: true, authUrl: url.toString(), state };
};

xConnector._completeAuth = async ({ code, stateMeta, error, errorDescription, state }) => {
  if (error) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError(error, "X"), detail: errorDescription };
  }
  if (!code) return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "X") };
  const creds = xConnector.getAppCredentials();
  const secrets = readSecrets();
  const verifier = secrets.oauthPkce?.[state];
  if (verifier) {
    delete secrets.oauthPkce[state];
    writeSecrets(secrets);
  }
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code_verifier: verifier || "",
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "X"),
      detail: tokenJson.error_description || tokenJson.error,
    };
  }
  setAccountTokens("x", stateMeta.accountId, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt: tokenJson.expires_in
      ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
      : null,
    scopes: String(tokenJson.scope || "").split(" "),
  });

  const meRes = await fetch("https://api.twitter.com/2/users/me?user.fields=public_metrics,username,name,profile_image_url", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const meJson = await meRes.json().catch(() => ({}));
  const user = meJson.data || {};
  if (user.id) {
    setAccountTokens("x", stateMeta.accountId, {
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token || null,
      expiresAt: tokenJson.expires_in
        ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
        : null,
      scopes: String(tokenJson.scope || "").split(" "),
      providerAccountId: user.id,
    });
  }
  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      providerAccountId: user.id || null,
      displayName: user.name || "",
      handle: user.username ? `@${user.username}` : "",
      profileUrl: user.username ? `https://x.com/${user.username}` : "",
      followerCount: user.public_metrics?.followers_count ?? null,
      raw: user,
    },
  };
};

xConnector._getProfile = async (_account, tokens) => {
  const res = await fetch("https://api.twitter.com/2/users/me?user.fields=public_metrics,username,name", {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, connectionState: "RECONNECT_REQUIRED", error: friendlyOAuthError("invalid_grant", "X") };
  }
  const user = json.data || {};
  return {
    ok: true,
    profile: {
      providerAccountId: user.id,
      displayName: user.name,
      handle: user.username ? `@${user.username}` : "",
      profileUrl: user.username ? `https://x.com/${user.username}` : "",
      followerCount: user.public_metrics?.followers_count ?? null,
      raw: user,
    },
  };
};

xConnector._getAccountMetrics = async (account, tokens) => {
  const profile = await xConnector._getProfile(account, tokens);
  if (!profile.ok) return profile;
  return {
    ok: true,
    metrics: {
      followers: profile.profile.followerCount,
      followersGained: null,
    },
    source: "PROVIDER",
    capturedAt: new Date().toISOString(),
    raw: profile.profile.raw?.public_metrics || null,
  };
};

xConnector._getContent = async () => unavailable("Recent posts require elevated X API access for some plans.");
xConnector._getContentMetrics = async () => unavailable("Tweet metrics require X API access.");
xConnector._publishContent = async (_account, payload, tokens) => {
  if (!payload?.text && !payload?.caption) {
    return unavailable("X publishing requires text (PUBLISH_TEXT).");
  }
  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: payload.text || payload.caption }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      error: json.detail || json.title || json.error || "Publish failed",
      raw: json,
    };
  }
  return {
    ok: true,
    providerPostId: json.data?.id || null,
    raw: json,
  };
};

xConnector._disconnect = async (account) => {
  clearAccountTokens("x", account.id);
  return { ok: true, connectionState: "UNCONNECTED" };
};
