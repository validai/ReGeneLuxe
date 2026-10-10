import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, envCredentials, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import { THREADS_CALLBACK_URL, threadsRedirectUri } from "../threadsHttpsBridge.js";

const THREADS_AUTHORIZE = "https://threads.com/oauth/authorize";
const THREADS_TOKEN = "https://graph.threads.com/oauth/access_token";
const THREADS_GRAPH = "https://graph.threads.com";
const THREADS_SCOPE = "threads_basic";

export const threadsConnector = baseConnector({
  provider: "threads",
  displayName: "Threads",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Add the Access the Threads API use case to the existing ReGeneLuxe Social Meta app",
    "2. Set THREADS_APP_ID and THREADS_APP_SECRET from that use case. Do not reuse the Facebook app secret",
    `3. Add redirect URI: ${THREADS_CALLBACK_URL}`,
  ].join("\n"),
  envKeys: {
    clientId: "THREADS_APP_ID",
    clientSecret: "THREADS_APP_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
    CAPABILITY.PUBLISH_TEXT,
  ],
});

threadsConnector.getAppCredentials = () => {
  const creds = envCredentials("threads", {
    clientId: "THREADS_APP_ID",
    clientSecret: "THREADS_APP_SECRET",
  });
  return {
    ...creds,
    redirectUri: threadsRedirectUri(),
  };
};

threadsConnector.resolveReadiness = () => {
  const creds = threadsConnector.getAppCredentials();
  return creds.complete && creds.redirectUri
    ? PROVIDER_READINESS.IMPLEMENTED
    : PROVIDER_READINESS.SETUP_REQUIRED;
};

function safeThreadsError(json, status) {
  const message = String(json?.error_message || json?.error?.message || json?.error_description || "").toLowerCase();
  if (/permission|scope|not authorized to|requires .*permission/.test(message)) {
    return {
      ok: false,
      code: "PERMISSION_MISSING",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "Threads did not grant permission to read this profile.",
    };
  }
  if (/client secret|client_id|invalid client|unknown app|threads api/.test(message)) {
    return {
      ok: false,
      code: "SETUP_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "Threads app credentials are not configured.",
    };
  }
  if (status === 401 || /already used|expired|invalid.?grant|invalid.?token|code was not found/.test(message)) {
    return {
      ok: false,
      code: "RECONNECT_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: friendlyOAuthError("invalid_grant", "Threads"),
    };
  }
  if (status >= 500) {
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "Threads is temporarily unavailable.",
    };
  }
  return {
    ok: false,
    code: "PROVIDER_ERROR",
    connectionState: SOCIAL_CONNECTION_STATES.ERROR,
    error: "Threads could not complete this connection.",
  };
}

threadsConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = threadsConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: threadsConnector.setupInstructions,
      message: "Threads app credentials are not configured.",
    };
  }
  const state = createOAuthState({
    provider: "threads",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
  });
  const url = new URL(THREADS_AUTHORIZE);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", THREADS_SCOPE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return { ok: true, authUrl: url.toString(), state };
};

threadsConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = String(error) === "access_denied";
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(error, "Threads"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|client_secret|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").replace(/#_$/, "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "Threads") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  if (!accountKey) {
    return { ok: false, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Threads connection session is missing." };
  }
  const creds = threadsConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      code: "SETUP_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "Threads app credentials are not configured.",
    };
  }
  const tokenRes = await fetch(THREADS_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code: authorizationCode,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return safeThreadsError(tokenJson, tokenRes.status);

  const exchangeUrl = new URL(`${THREADS_GRAPH}/access_token`);
  exchangeUrl.searchParams.set("grant_type", "th_exchange_token");
  exchangeUrl.searchParams.set("client_secret", creds.clientSecret);
  exchangeUrl.searchParams.set("access_token", tokenJson.access_token);
  const exchange = await fetch(exchangeUrl);
  const exchangeJson = await exchange.json().catch(() => ({}));
  const accessToken = exchange.ok && exchangeJson.access_token ? exchangeJson.access_token : tokenJson.access_token;
  const profileUrl = new URL(`${THREADS_GRAPH}/v1.0/me`);
  profileUrl.searchParams.set("fields", "id,username,name");
  profileUrl.searchParams.set("access_token", accessToken);
  const profileRes = await fetch(profileUrl);
  const profile = await profileRes.json().catch(() => ({}));
  if (!profileRes.ok) return safeThreadsError(profile, profileRes.status);
  if (!profile.id) {
    return {
      ok: false,
      code: "NO_DESTINATIONS",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "No Threads profile was returned for this account.",
    };
  }
  const expiresIn = Number((exchange.ok && exchangeJson.expires_in) || tokenJson.expires_in || 0);
  const scopes = String(tokenJson.scope || THREADS_SCOPE).split(/[,\s]+/).filter(Boolean);
  setAccountTokens("threads", accountKey, {
    accessToken,
    refreshToken: null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes,
    providerAccountId: String(profile.id),
  });
  return {
    ok: true,
    connectionState: SOCIAL_CONNECTION_STATES.CONNECTED,
    profile: {
      providerAccountId: String(profile.id),
      displayName: profile.name || profile.username || "",
      handle: profile.username ? `@${profile.username}` : "",
      profileUrl: profile.username ? `https://www.threads.net/@${profile.username}` : "",
    },
  };
};

threadsConnector._getProfile = async (_account, tokens) => {
  const id = tokens.providerAccountId || "me";
  const res = await fetch(
    `${THREADS_GRAPH}/v1.0/${encodeURIComponent(id)}?fields=id,username,name&access_token=${encodeURIComponent(tokens.accessToken)}`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "Threads") };
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
  const createRes = await fetch(`${THREADS_GRAPH}/v1.0/${userId}/threads`, {
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
  const pubRes = await fetch(`${THREADS_GRAPH}/v1.0/${userId}/threads_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      creation_id: created.id,
      access_token: tokens.accessToken,
    }),
  });
  const published = await pubRes.json().catch(() => ({}));
  if (!pubRes.ok || !published.id) {
    return { ok: false, error: published.error?.message || "Threads publish failed." };
  }
  const linkRes = await fetch(
    `${THREADS_GRAPH}/v1.0/${published.id}?fields=id,permalink&access_token=${encodeURIComponent(tokens.accessToken)}`,
  );
  const link = await linkRes.json().catch(() => ({}));
  return {
    ok: true,
    providerPostId: published.id,
    externalUrl: link.permalink || "",
    permalink: link.permalink || "",
    providerStatus: "PUBLISHED",
  };
};

threadsConnector._disconnect = async (account) => {
  clearAccountTokens("threads", account.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
