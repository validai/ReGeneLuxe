import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

export const threadsConnector = baseConnector({
  provider: "threads",
  displayName: "Threads",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create a Meta app with Threads API product",
    "2. Set THREADS_APP_ID and THREADS_APP_SECRET (or META_APP_ID / META_APP_SECRET fallback)",
    `3. Add redirect URI: ${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/threads/callback`,
  ].join("\n"),
  envKeys: {
    clientId: "THREADS_APP_ID",
    clientSecret: "THREADS_APP_SECRET",
    redirectUri: "THREADS_REDIRECT_URI",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.READ_CONTENT,
    CAPABILITY.PUBLISH_TEXT,
    CAPABILITY.PUBLISH_IMAGE,
  ],
});

const originalGet = threadsConnector.getAppCredentials.bind(threadsConnector);
threadsConnector.getAppCredentials = () => {
  const own = originalGet();
  if (own.complete) return own;
  const metaId = process.env.META_APP_ID || "";
  const metaSecret = process.env.META_APP_SECRET || "";
  if (metaId && metaSecret) {
    return {
      complete: true,
      clientId: metaId,
      clientSecret: metaSecret,
      redirectUri: process.env.THREADS_REDIRECT_URI
        || `${process.env.RL_PUBLIC_ORIGIN || "http://127.0.0.1:5174"}/api/oauth/threads/callback`,
      source: "meta-env-fallback",
    };
  }
  return own;
};

threadsConnector._beginAuth = async ({ accountId, returnTo }) => {
  const creds = threadsConnector.getAppCredentials();
  if (!creds.complete) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      instructions: threadsConnector.setupInstructions,
      message: "Threads app credentials are not configured.",
    };
  }
  const state = createOAuthState({ provider: "threads", accountId, returnTo });
  const url = new URL("https://threads.net/oauth/authorize");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", "threads_basic,threads_content_publish");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return { ok: true, authUrl: url.toString(), state };
};

threadsConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError(error, "Threads"), detail: errorDescription };
  }
  if (!code) return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "Threads") };
  const creds = threadsConnector.getAppCredentials();
  const tokenRes = await fetch("https://graph.threads.net/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "Threads"),
      detail: tokenJson.error_message || tokenJson.error?.message,
    };
  }
  setAccountTokens("threads", stateMeta.accountId, {
    accessToken: tokenJson.access_token,
    refreshToken: null,
    expiresAt: null,
    scopes: ["threads_basic", "threads_content_publish"],
    providerAccountId: tokenJson.user_id ? String(tokenJson.user_id) : null,
  });
  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      providerAccountId: tokenJson.user_id ? String(tokenJson.user_id) : null,
      displayName: "",
      handle: "",
      profileUrl: "",
    },
  };
};

threadsConnector._getProfile = async (_account, tokens) => {
  const id = tokens.providerAccountId || "me";
  const res = await fetch(
    `https://graph.threads.net/v1.0/${id}?fields=id,username,name&access_token=${encodeURIComponent(tokens.accessToken)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, connectionState: "RECONNECT_REQUIRED", error: friendlyOAuthError("invalid_grant", "Threads") };
  }
  return {
    ok: true,
    profile: {
      providerAccountId: json.id,
      displayName: json.name || json.username || "",
      handle: json.username ? `@${json.username}` : "",
      profileUrl: json.username ? `https://www.threads.net/@${json.username}` : "",
      raw: json,
    },
  };
};

threadsConnector._getAccountMetrics = async () => unavailable("Threads account metrics not exposed for this app yet.");
threadsConnector._getContent = async () => unavailable("Threads content list requires additional scopes.");
threadsConnector._getContentMetrics = async () => unavailable("Threads content metrics unavailable.");

threadsConnector._publishContent = async (_account, payload, tokens) => {
  const text = payload?.text || payload?.caption;
  if (!text) return unavailable("Threads publishing requires text.");
  const userId = tokens.providerAccountId;
  if (!userId) return unavailable("Threads user id missing — reconnect.");
  const createRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      media_type: "TEXT",
      text,
      access_token: tokens.accessToken,
    }),
  });
  const created = await createRes.json().catch(() => ({}));
  if (!createRes.ok || !created.id) {
    return { ok: false, error: created.error?.message || "Failed to create Threads container." };
  }
  const pubRes = await fetch(`https://graph.threads.net/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: created.id,
      access_token: tokens.accessToken,
    }),
  });
  const published = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok) {
    return { ok: false, error: published.error?.message || "Threads publish failed." };
  }
  return { ok: true, providerPostId: published.id || created.id, raw: published };
};

threadsConnector._disconnect = async (account) => {
  clearAccountTokens("threads", account.id);
  return { ok: true, connectionState: "UNCONNECTED" };
};
