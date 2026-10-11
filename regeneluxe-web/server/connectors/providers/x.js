import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, defaultRedirect, envCredentials, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

const X_AUTHORIZE = "https://x.com/i/oauth2/authorize";
const X_TOKEN = "https://api.x.com/2/oauth2/token";
const X_USERS_ME = "https://api.x.com/2/users/me";
const X_SCOPE = "users.read offline.access";

export const xConnector = baseConnector({
  provider: "x",
  displayName: "X",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create an X developer app in the Developer Console and enable OAuth 2.0 as a confidential Web App",
    "2. Set X_CLIENT_ID and X_CLIENT_SECRET from that app. Do not use a bearer token",
    `3. Add callback URL: ${defaultRedirect("x")}`,
    "4. Request users.read and offline.access. Profile lookup is a billed X user read",
  ].join("\n"),
  envKeys: {
    clientId: "X_CLIENT_ID",
    clientSecret: "X_CLIENT_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

xConnector.getAppCredentials = () => {
  const creds = envCredentials("x", {
    clientId: "X_CLIENT_ID",
    clientSecret: "X_CLIENT_SECRET",
  });
  return {
    ...creds,
    redirectUri: canonicalOAuthRedirect(process.env.X_REDIRECT_URI) || defaultRedirect("x"),
  };
};

function scrubbedTitle(json) {
  const title = String(json?.title || "").trim();
  if (!/^[A-Za-z0-9_ .:-]{1,80}$/.test(title)) return "";
  if (/token|secret|verifier|authorization/i.test(title)) return "";
  return title;
}

function classifyXFailure(json, status) {
  const blob = `${json?.title || ""} ${json?.detail || ""} ${json?.error || ""} ${json?.error_description || ""}`.toLowerCase();
  const providerStatus = scrubbedTitle(json);
  const base = { ok: false, ...(providerStatus ? { providerStatus } : {}) };
  if (status === 429 || /rate limit|too many requests/.test(blob)) {
    return {
      ...base,
      code: "RATE_LIMITED",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "X rate limit reached. Try again shortly.",
    };
  }
  if (status === 402 || /credit|payment required|spend limit/.test(blob)) {
    return {
      ...base,
      code: "PLAN_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "X API credits are required to read this profile.",
    };
  }
  if (/scope|permission|not authorized|users\.read/.test(blob)) {
    return {
      ...base,
      code: "PERMISSION_MISSING",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "X did not grant permission to read this profile.",
    };
  }
  if (/invalid_client|unauthorized_client|client_id|client secret/.test(blob)) {
    return {
      ...base,
      code: "SETUP_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "X app credentials are not configured.",
    };
  }
  if (status === 401 || /invalid_grant|expired token|revoked/.test(blob)) {
    return {
      ...base,
      code: "RECONNECT_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: friendlyOAuthError("invalid_grant", "X"),
    };
  }
  if (status >= 500) {
    return {
      ...base,
      code: "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "X is temporarily unavailable.",
    };
  }
  return {
    ...base,
    code: "PROVIDER_ERROR",
    connectionState: SOCIAL_CONNECTION_STATES.ERROR,
    error: "X could not complete this connection.",
  };
}

function profileFromUser(user) {
  const username = String(user?.username || "").replace(/^@/, "");
  return {
    providerAccountId: user?.id ? String(user.id) : "",
    displayName: user?.name || "",
    handle: username ? `@${username}` : "",
    profileUrl: username ? `https://x.com/${username}` : "",
    ...(user?.profile_image_url ? { profileImageUrl: String(user.profile_image_url) } : {}),
  };
}

function storeXTokens(accountKey, tokenJson, providerAccountId) {
  const expiresIn = Number(tokenJson.expires_in || 0);
  const scopes = String(tokenJson.scope || X_SCOPE).split(/[\s,]+/).filter(Boolean);
  setAccountTokens("x", accountKey, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes,
    providerAccountId: providerAccountId || null,
  });
}

xConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = xConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: xConnector.setupInstructions,
      message: "X app credentials are not configured.",
    };
  }
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({
    provider: "x",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
    pkceVerifier: verifier,
  });
  const url = new URL(X_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", X_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { ok: true, authUrl: url.toString(), state };
};

xConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = String(error) === "access_denied";
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(error, "X"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|refresh_token|client_secret|code_verifier|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "X") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  const verifier = String(stateMeta?.pkceVerifier || "");
  if (!accountKey || !verifier) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("invalid_grant", "X") };
  }
  const creds = xConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      code: "SETUP_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "X app credentials are not configured.",
    };
  }
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const tokenRes = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      code: authorizationCode,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code_verifier: verifier,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyXFailure(tokenJson, tokenRes.status);

  const profileUrl = new URL(X_USERS_ME);
  profileUrl.searchParams.set("user.fields", "id,username,name,profile_image_url");
  const meRes = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const meJson = await meRes.json().catch(() => ({}));
  if (!meRes.ok) return classifyXFailure(meJson, meRes.status);
  const profile = profileFromUser(meJson.data || {});
  if (!profile.providerAccountId) {
    return {
      ok: false,
      code: "NO_DESTINATIONS",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: "No X account was returned for this authorization.",
    };
  }
  storeXTokens(accountKey, tokenJson, profile.providerAccountId);
  return {
    ok: true,
    connectionState: SOCIAL_CONNECTION_STATES.CONNECTED,
    profile,
  };
};

xConnector._getProfile = async (_account, tokens) => {
  const profileUrl = new URL(X_USERS_ME);
  profileUrl.searchParams.set("user.fields", "id,username,name,profile_image_url");
  const res = await fetch(profileUrl, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return classifyXFailure(json, res.status);
  const profile = profileFromUser(json.data || {});
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No X account was returned for this authorization." };
  }
  return { ok: true, profile };
};

xConnector._getAccountMetrics = async () => unavailable("X account metrics are not part of this connection.");
xConnector._getContent = async () => unavailable("X posts are not read for this connection.");
xConnector._getContentMetrics = async () => unavailable("X post metrics are not part of this connection.");

// Text posting exists from an earlier connector and has not been live-tested.
// It is not a connection capability and is not advertised.
xConnector._publishContent = async (_account, payload, tokens) => {
  if (!payload?.text && !payload?.caption) {
    return unavailable("X publishing requires text.");
  }
  const res = await fetch("https://api.x.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: payload.text || payload.caption }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return classifyXFailure(json, res.status);
  return {
    ok: true,
    providerPostId: json.data?.id || null,
  };
};

xConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return {
      ok: false,
      code: "RECONNECT_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
      error: friendlyOAuthError("invalid_grant", "X"),
    };
  }
  const creds = xConnector.getAppCredentials();
  if (!creds.complete) {
    return {
      ok: false,
      code: "SETUP_REQUIRED",
      connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
      error: "X app credentials are not configured.",
    };
  }
  const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString("base64");
  const tokenRes = await fetch(X_TOKEN, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyXFailure(tokenJson, tokenRes.status);
  storeXTokens(account.id, {
    ...tokenJson,
    refresh_token: tokenJson.refresh_token || tokens.refreshToken,
  }, tokens.providerAccountId);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED };
};

xConnector._disconnect = async (account) => {
  clearAccountTokens("x", account.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
