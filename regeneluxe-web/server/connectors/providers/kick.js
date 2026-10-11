import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, defaultRedirect, envCredentials, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, getAccountTokens, setAccountTokens } from "../../secrets/providers.js";

const KICK_AUTHORIZE = "https://id.kick.com/oauth/authorize";
const KICK_TOKEN = "https://id.kick.com/oauth/token";
const KICK_INTROSPECT = "https://id.kick.com/oauth/token/introspect";
const KICK_REVOKE = "https://id.kick.com/oauth/revoke";
const KICK_USERS = "https://api.kick.com/public/v1/users";
const KICK_SCOPE = "user:read";

export const kickConnector = baseConnector({
  provider: "kick",
  displayName: "Kick",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Enable 2FA, then create a Kick app at https://kick.com/settings/developer",
    "2. Set KICK_CLIENT_ID and KICK_CLIENT_SECRET. Keep the secret on the server",
    `3. Register this exact redirect URL: ${defaultRedirect("kick")}`,
    "4. Request only user:read. Do not enable chat, channel, stream key, or event scopes",
  ].join("\n"),
  envKeys: {
    clientId: "KICK_CLIENT_ID",
    clientSecret: "KICK_CLIENT_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

kickConnector.getAppCredentials = () => {
  const creds = envCredentials("kick", {
    clientId: "KICK_CLIENT_ID",
    clientSecret: "KICK_CLIENT_SECRET",
  });
  return {
    ...creds,
    redirectUri: canonicalOAuthRedirect(process.env.KICK_REDIRECT_URI) || defaultRedirect("kick"),
  };
};

function errorBlob(json) {
  if (!json || typeof json !== "object") return "";
  return [json.error, json.message, json.error_description]
    .filter((part) => typeof part === "string")
    .join(" ");
}

function classifyKickFailure(json, status, phase = "") {
  const blob = errorBlob(json).toLowerCase();
  const base = { ok: false };
  if (status === 429 || /rate limit|too many requests/.test(blob)) {
    return { ...base, code: "RATE_LIMITED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick rate limit reached. Try again shortly." };
  }
  if (/payment|billing|credits|paid plan/.test(blob)) {
    return { ...base, code: "PLAN_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Kick requires a paid plan for this request." };
  }
  if (/app review|not approved|suspended|under review/.test(blob)) {
    return { ...base, code: "REVIEW_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "This Kick application is not approved for this request." };
  }
  if (/invalid_client|invalid client/.test(blob)) {
    return { ...base, code: "INVALID_CLIENT", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Kick app credentials are not configured." };
  }
  if (/redirect/.test(blob)) {
    return { ...base, code: "INVALID_REDIRECT", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Kick rejected the callback URL." };
  }
  if (/pkce|code_verifier|code_challenge/.test(blob)) {
    return { ...base, code: "INVALID_PKCE", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: "Kick could not verify this authorization. Start the connection again." };
  }
  if (/insufficient scope|missing scope|scope_not_authorized|forbidden/.test(blob)) {
    return { ...base, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick did not grant permission to read this account." };
  }
  if (status === 401 || /invalid_grant|invalid token|expired/.test(blob)) {
    return { ...base, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "Kick") };
  }
  if (phase === "token" && status >= 400 && status < 500) {
    return { ...base, code: "TOKEN_EXCHANGE_FAILED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick could not exchange this authorization." };
  }
  if (status >= 500) {
    return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick is temporarily unavailable." };
  }
  return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick could not complete this connection." };
}

function scopeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return String(value || "").split(/[\s,]+/).filter(Boolean);
}

function profileFromUser(user) {
  const id = user?.user_id == null ? "" : String(user.user_id);
  const name = String(user?.name || "").trim();
  const username = /^[A-Za-z0-9_]{2,25}$/.test(name) ? name : "";
  return {
    providerAccountId: id,
    displayName: name,
    handle: username ? `@${username}` : "",
    profileUrl: username ? `https://kick.com/${username}` : "",
    ...(user?.profile_picture ? { profileImageUrl: String(user.profile_picture) } : {}),
  };
}

function storeKickTokens(accountKey, tokenJson, providerAccountId, previousRefresh = null) {
  const expiresIn = Number(tokenJson.expires_in || 0);
  setAccountTokens("kick", accountKey, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || previousRefresh || null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: scopeList(tokenJson.scope),
    providerAccountId: providerAccountId || null,
    tokenType: String(tokenJson.token_type || "bearer").toLowerCase(),
  });
}

async function readKickIdentity(accessToken, clientId) {
  const introspectRes = await fetch(KICK_INTROSPECT, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const introspectJson = await introspectRes.json().catch(() => ({}));
  if (!introspectRes.ok) return { failure: classifyKickFailure(introspectJson, introspectRes.status, "introspect") };
  const tokenInfo = introspectJson.data || {};
  if (tokenInfo.active !== true) {
    return {
      failure: {
        ok: false,
        code: "TOKEN_INACTIVE",
        connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED,
        error: "Kick reported this token as inactive.",
      },
    };
  }
  if (String(tokenInfo.client_id || "") !== clientId) {
    return {
      failure: {
        ok: false,
        code: "INVALID_CLIENT",
        connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED,
        error: "Kick token was not issued for this application.",
      },
    };
  }
  if (String(tokenInfo.token_type || "") !== "user") {
    return {
      failure: {
        ok: false,
        code: "NO_DESTINATIONS",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "No Kick account was returned for this authorization.",
      },
    };
  }
  if (!scopeList(tokenInfo.scope).includes(KICK_SCOPE)) {
    return {
      failure: {
        ok: false,
        code: "PERMISSION_MISSING",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "Kick did not grant permission to read this account.",
      },
    };
  }
  const userRes = await fetch(KICK_USERS, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userJson = await userRes.json().catch(() => ({}));
  if (!userRes.ok) return { failure: classifyKickFailure(userJson, userRes.status, "user") };
  const user = Array.isArray(userJson.data) ? userJson.data[0] : null;
  const profile = profileFromUser(user);
  if (!profile.providerAccountId) {
    return {
      failure: {
        ok: false,
        code: "NO_DESTINATIONS",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "No Kick account was returned for this authorization.",
      },
    };
  }
  return { profile };
}

kickConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = kickConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: kickConnector.setupInstructions,
      message: "Kick app credentials are not configured.",
    };
  }
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({
    provider: "kick",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
    pkceVerifier: verifier,
  });
  const url = new URL(KICK_AUTHORIZE);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("scope", KICK_SCOPE);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { ok: true, authUrl: url.toString(), state };
};

kickConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = String(error) === "access_denied";
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(error, "Kick"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|refresh_token|client_secret|code_verifier|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "Kick") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  const verifier = String(stateMeta?.pkceVerifier || "");
  if (!accountKey || !verifier) {
    return { ok: false, code: "INVALID_PKCE", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: "Kick could not verify this authorization. Start the connection again." };
  }
  const creds = kickConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Kick app credentials are not configured." };
  }
  const tokenRes = await fetch(KICK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: creds.redirectUri,
      code_verifier: verifier,
      code: authorizationCode,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyKickFailure(tokenJson, tokenRes.status, "token");
  if (!scopeList(tokenJson.scope).includes(KICK_SCOPE)) {
    return { ok: false, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Kick did not grant permission to read this account." };
  }
  const identity = await readKickIdentity(tokenJson.access_token, creds.clientId);
  if (identity.failure) return identity.failure;
  storeKickTokens(accountKey, tokenJson, identity.profile.providerAccountId);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED, profile: identity.profile };
};

kickConnector._getProfile = async (_account, tokens) => {
  const userRes = await fetch(KICK_USERS, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const userJson = await userRes.json().catch(() => ({}));
  if (!userRes.ok) return classifyKickFailure(userJson, userRes.status, "user");
  const profile = profileFromUser(Array.isArray(userJson.data) ? userJson.data[0] : null);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No Kick account was returned for this authorization." };
  }
  return { ok: true, profile };
};

kickConnector._getAccountMetrics = async () => unavailable("Kick account metrics are not part of this connection.");
kickConnector._getContent = async () => unavailable("Kick livestreams are not read for this connection.");
kickConnector._getContentMetrics = async () => unavailable("Kick livestream metrics are not part of this connection.");
kickConnector._publishContent = async () => unavailable("Kick stream actions are not part of this connection.");

kickConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "Kick") };
  }
  const creds = kickConnector.getAppCredentials();
  if (!creds.complete) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Kick app credentials are not configured." };
  }
  const tokenRes = await fetch(KICK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: tokens.refreshToken,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyKickFailure(tokenJson, tokenRes.status, "token");
  storeKickTokens(account.id, tokenJson, tokens.providerAccountId, tokens.refreshToken);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED };
};

kickConnector._disconnect = async (account) => {
  const tokens = getAccountTokens("kick", account?.id);
  const token = tokens?.refreshToken || tokens?.accessToken;
  if (token) {
    const url = new URL(KICK_REVOKE);
    url.searchParams.set("token", token);
    url.searchParams.set("token_hint_type", tokens?.refreshToken ? "refresh_token" : "access_token");
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      });
    } catch {
      // Local credential removal still proceeds.
    }
  }
  clearAccountTokens("kick", account?.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
