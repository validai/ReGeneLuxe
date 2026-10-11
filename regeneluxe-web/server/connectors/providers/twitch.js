import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, defaultRedirect, envCredentials, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, getAccountTokens, setAccountTokens } from "../../secrets/providers.js";

const TWITCH_AUTHORIZE = "https://id.twitch.tv/oauth2/authorize";
const TWITCH_TOKEN = "https://id.twitch.tv/oauth2/token";
const TWITCH_VALIDATE = "https://id.twitch.tv/oauth2/validate";
const TWITCH_REVOKE = "https://id.twitch.tv/oauth2/revoke";
const TWITCH_USERS = "https://api.twitch.tv/helix/users";

export const twitchConnector = baseConnector({
  provider: "twitch",
  displayName: "Twitch",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Register a Twitch application at https://dev.twitch.tv/console/apps",
    "2. Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET. Keep the secret on the server",
    `3. Register this exact OAuth redirect URL: ${defaultRedirect("twitch")}`,
    "4. Request no extra scopes. This connection only identifies the Twitch account",
  ].join("\n"),
  envKeys: {
    clientId: "TWITCH_CLIENT_ID",
    clientSecret: "TWITCH_CLIENT_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

twitchConnector.getAppCredentials = () => {
  const creds = envCredentials("twitch", {
    clientId: "TWITCH_CLIENT_ID",
    clientSecret: "TWITCH_CLIENT_SECRET",
  });
  return {
    ...creds,
    redirectUri: canonicalOAuthRedirect(process.env.TWITCH_REDIRECT_URI) || defaultRedirect("twitch"),
  };
};

function errorBlob(json) {
  if (!json || typeof json !== "object") return "";
  return [json.error, json.message, json.error_description]
    .filter((part) => typeof part === "string")
    .join(" ");
}

function classifyTwitchFailure(json, status) {
  const blob = errorBlob(json).toLowerCase();
  const base = { ok: false };
  if (status === 429 || /rate limit|too many requests/.test(blob)) {
    return { ...base, code: "RATE_LIMITED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Twitch rate limit reached. Try again shortly." };
  }
  if (/payment|billing|credits|paid plan/.test(blob)) {
    return { ...base, code: "PLAN_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Twitch requires a paid plan for this request." };
  }
  if (/app review|not approved|suspended|under review/.test(blob)) {
    return { ...base, code: "REVIEW_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "This Twitch application is not approved for this request." };
  }
  if (/insufficient scope|missing scope|scope_not_authorized|requires .*scope/.test(blob)) {
    return { ...base, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Twitch did not grant permission to read this account." };
  }
  if (/invalid_client|invalid client/.test(blob)) {
    return { ...base, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Twitch app credentials are not configured." };
  }
  if (status === 401 || /invalid_grant|invalid access token|invalid oauth token|invalid refresh token|expired/.test(blob)) {
    return { ...base, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "Twitch") };
  }
  if (status >= 500) {
    return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Twitch is temporarily unavailable." };
  }
  return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "Twitch could not complete this connection." };
}

function profileFromUser(user) {
  const id = String(user?.id || "");
  const login = String(user?.login || "").trim();
  const broadcasterType = String(user?.broadcaster_type || "").trim();
  return {
    providerAccountId: id,
    displayName: user?.display_name || login || "",
    handle: login ? `@${login.replace(/^@/, "")}` : "",
    profileUrl: login ? `https://www.twitch.tv/${encodeURIComponent(login)}` : "",
    ...(user?.profile_image_url ? { profileImageUrl: String(user.profile_image_url) } : {}),
    ...(broadcasterType ? { broadcasterType } : {}),
  };
}

function scopesFromToken(tokenJson) {
  const scope = tokenJson?.scope;
  if (Array.isArray(scope)) return scope.map((item) => String(item)).filter(Boolean);
  return String(scope || "").split(/[,\s]+/).filter(Boolean);
}

function storeTwitchTokens(accountKey, tokenJson, providerAccountId, previousRefresh = null) {
  const expiresIn = Number(tokenJson.expires_in || 0);
  setAccountTokens("twitch", accountKey, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || previousRefresh || null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: scopesFromToken(tokenJson),
    providerAccountId: providerAccountId || null,
    tokenType: String(tokenJson.token_type || "bearer").toLowerCase(),
  });
}

async function readTwitchIdentity(accessToken, clientId) {
  const validateRes = await fetch(TWITCH_VALIDATE, {
    headers: { Authorization: `OAuth ${accessToken}` },
  });
  const validateJson = await validateRes.json().catch(() => ({}));
  if (!validateRes.ok) return { failure: classifyTwitchFailure(validateJson, validateRes.status) };
  if (String(validateJson.client_id || "") !== clientId) {
    return {
      failure: {
        ok: false,
        code: "PROVIDER_ERROR",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "Twitch token was not issued for this application.",
      },
    };
  }
  if (!validateJson.user_id) {
    return {
      failure: {
        ok: false,
        code: "NO_DESTINATIONS",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "No Twitch account was returned for this authorization.",
      },
    };
  }
  const userRes = await fetch(TWITCH_USERS, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Client-Id": clientId,
    },
  });
  const userJson = await userRes.json().catch(() => ({}));
  if (!userRes.ok) return { failure: classifyTwitchFailure(userJson, userRes.status) };
  const user = Array.isArray(userJson.data) ? userJson.data[0] : null;
  const profile = profileFromUser(user);
  if (!profile.providerAccountId) {
    return {
      failure: {
        ok: false,
        code: "NO_DESTINATIONS",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "No Twitch account was returned for this authorization.",
      },
    };
  }
  if (profile.providerAccountId !== String(validateJson.user_id)) {
    return {
      failure: {
        ok: false,
        code: "PROVIDER_ERROR",
        connectionState: SOCIAL_CONNECTION_STATES.ERROR,
        error: "Twitch account id did not match the validated token.",
      },
    };
  }
  return { profile };
}

twitchConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = twitchConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: twitchConnector.setupInstructions,
      message: "Twitch app credentials are not configured.",
    };
  }
  const state = createOAuthState({
    provider: "twitch",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
  });
  const url = new URL(TWITCH_AUTHORIZE);
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("force_verify", "true");
  return { ok: true, authUrl: url.toString(), state };
};

twitchConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = String(error) === "access_denied";
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(error, "Twitch"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|refresh_token|client_secret|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "Twitch") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  if (!accountKey) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("invalid_grant", "Twitch") };
  }
  const creds = twitchConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Twitch app credentials are not configured." };
  }
  const tokenRes = await fetch(TWITCH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyTwitchFailure(tokenJson, tokenRes.status);
  const identity = await readTwitchIdentity(tokenJson.access_token, creds.clientId);
  if (identity.failure) return identity.failure;
  storeTwitchTokens(accountKey, tokenJson, identity.profile.providerAccountId);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED, profile: identity.profile };
};

twitchConnector._getProfile = async (_account, tokens) => {
  const creds = twitchConnector.getAppCredentials();
  if (!creds.clientId) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Twitch app credentials are not configured." };
  }
  const userRes = await fetch(TWITCH_USERS, {
    headers: {
      Authorization: `Bearer ${tokens.accessToken}`,
      "Client-Id": creds.clientId,
    },
  });
  const userJson = await userRes.json().catch(() => ({}));
  if (!userRes.ok) return classifyTwitchFailure(userJson, userRes.status);
  const profile = profileFromUser(Array.isArray(userJson.data) ? userJson.data[0] : null);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No Twitch account was returned for this authorization." };
  }
  return { ok: true, profile };
};

twitchConnector._getAccountMetrics = async () => unavailable("Twitch account metrics are not part of this connection.");
twitchConnector._getContent = async () => unavailable("Twitch streams and clips are not read for this connection.");
twitchConnector._getContentMetrics = async () => unavailable("Twitch stream metrics are not part of this connection.");
twitchConnector._publishContent = async () => unavailable("Twitch stream actions are not part of this connection.");

twitchConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "Twitch") };
  }
  const creds = twitchConnector.getAppCredentials();
  if (!creds.complete) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "Twitch app credentials are not configured." };
  }
  const tokenRes = await fetch(TWITCH_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyTwitchFailure(tokenJson, tokenRes.status);
  storeTwitchTokens(account.id, tokenJson, tokens.providerAccountId, tokens.refreshToken);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED };
};

twitchConnector._disconnect = async (account) => {
  const tokens = getAccountTokens("twitch", account?.id);
  const creds = twitchConnector.getAppCredentials();
  if (tokens?.accessToken && creds.clientId) {
    try {
      await fetch(TWITCH_REVOKE, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: creds.clientId,
          token: tokens.accessToken,
        }),
      });
    } catch {
      // Local credential removal still proceeds.
    }
  }
  clearAccountTokens("twitch", account?.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
