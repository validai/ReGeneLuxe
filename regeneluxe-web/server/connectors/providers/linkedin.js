import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, defaultRedirect, envCredentials, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

const LINKEDIN_AUTHORIZE = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_SCOPE = "openid profile";

export const linkedinConnector = baseConnector({
  provider: "linkedin",
  displayName: "LinkedIn",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create a LinkedIn app at https://www.linkedin.com/developers/apps/new and associate a Page you administer",
    "2. Add the Sign In with LinkedIn using OpenID Connect product",
    "3. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET. Keep the secret on the server",
    `4. Register this exact redirect URL: ${defaultRedirect("linkedin")}`,
    "5. Request only openid and profile. Do not add Share on LinkedIn or organization posting",
  ].join("\n"),
  envKeys: {
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

linkedinConnector.getAppCredentials = () => {
  const creds = envCredentials("linkedin", {
    clientId: "LINKEDIN_CLIENT_ID",
    clientSecret: "LINKEDIN_CLIENT_SECRET",
  });
  return {
    ...creds,
    redirectUri: canonicalOAuthRedirect(process.env.LINKEDIN_REDIRECT_URI) || defaultRedirect("linkedin"),
  };
};

function errorBlob(json) {
  if (!json || typeof json !== "object") return "";
  return [json.error, json.error_description, json.message]
    .filter((part) => typeof part === "string")
    .join(" ");
}

function classifyLinkedInFailure(json, status) {
  const blob = errorBlob(json).toLowerCase();
  const base = { ok: false };
  if (status === 429 || /rate limit|too many requests/.test(blob)) {
    return { ...base, code: "RATE_LIMITED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn rate limit reached. Try again shortly." };
  }
  if (/payment|billing|paid plan/.test(blob)) {
    return { ...base, code: "PLAN_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "LinkedIn requires a paid plan for this request." };
  }
  if (/invalid[_ ]scope|unauthorized_scope|not provisioned|scope is invalid/.test(blob)) {
    return { ...base, code: "REVIEW_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn has not enabled OpenID Connect for this application." };
  }
  if (/invalid_client|invalid client/.test(blob)) {
    return { ...base, code: "INVALID_CLIENT", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "LinkedIn app credentials are not configured." };
  }
  if (/redirect/.test(blob)) {
    return { ...base, code: "INVALID_REDIRECT", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "LinkedIn rejected the callback URL." };
  }
  if (/insufficient|permission|forbidden/.test(blob)) {
    return { ...base, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn did not grant permission to read this profile." };
  }
  if (status === 401 || /invalid_grant|expired|invalid token/.test(blob)) {
    return { ...base, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "LinkedIn") };
  }
  if (status >= 500) {
    return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn is temporarily unavailable." };
  }
  return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn could not complete this connection." };
}

function scopeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  return String(value || "").split(/[\s,]+/).filter(Boolean);
}

function hasIdentityScopes(value) {
  const scopes = scopeList(value);
  return scopes.includes("openid") && scopes.includes("profile");
}

function profileFromUserInfo(user) {
  const id = String(user?.sub || "").trim();
  return {
    providerAccountId: id,
    displayName: String(user?.name || "").trim(),
    handle: "",
    profileUrl: "",
    ...(user?.picture ? { profileImageUrl: String(user.picture) } : {}),
    ...(user?.given_name ? { givenName: String(user.given_name) } : {}),
    ...(user?.family_name ? { familyName: String(user.family_name) } : {}),
  };
}

function storeLinkedInTokens(accountKey, tokenJson, providerAccountId, previousRefresh = null) {
  const expiresIn = Number(tokenJson.expires_in || 0);
  const refreshToken = tokenJson.refresh_token || previousRefresh || null;
  setAccountTokens("linkedin", accountKey, {
    accessToken: tokenJson.access_token,
    refreshToken,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes: scopeList(tokenJson.scope),
    providerAccountId: providerAccountId || null,
    tokenType: String(tokenJson.token_type || "bearer").toLowerCase(),
  });
}

linkedinConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = linkedinConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: linkedinConnector.setupInstructions,
      message: "LinkedIn app credentials are not configured.",
    };
  }
  const state = createOAuthState({
    provider: "linkedin",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
  });
  const url = new URL(LINKEDIN_AUTHORIZE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_SCOPE);
  return { ok: true, authUrl: url.toString(), state };
};

linkedinConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = /access_denied|user_cancelled/.test(String(error));
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(denied ? "access_denied" : error, "LinkedIn"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|refresh_token|client_secret|id_token|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "LinkedIn") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  if (!accountKey) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("invalid_grant", "LinkedIn") };
  }
  const creds = linkedinConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "LinkedIn app credentials are not configured." };
  }
  const tokenRes = await fetch(LINKEDIN_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: authorizationCode,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      redirect_uri: creds.redirectUri,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyLinkedInFailure(tokenJson, tokenRes.status);
  if (tokenJson.scope && !hasIdentityScopes(tokenJson.scope)) {
    return { ok: false, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "LinkedIn did not grant permission to read this profile." };
  }
  const infoRes = await fetch(LINKEDIN_USERINFO, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const infoJson = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok) return classifyLinkedInFailure(infoJson, infoRes.status);
  const profile = profileFromUserInfo(infoJson);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No LinkedIn member was returned for this authorization." };
  }
  storeLinkedInTokens(accountKey, tokenJson, profile.providerAccountId);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED, profile };
};

linkedinConnector._getProfile = async (_account, tokens) => {
  const infoRes = await fetch(LINKEDIN_USERINFO, {
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  const infoJson = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok) return classifyLinkedInFailure(infoJson, infoRes.status);
  const profile = profileFromUserInfo(infoJson);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No LinkedIn member was returned for this authorization." };
  }
  return { ok: true, profile };
};

linkedinConnector._getAccountMetrics = async () => unavailable("LinkedIn account metrics are not part of this connection.");
linkedinConnector._getContent = async () => unavailable("LinkedIn posts are not read for this connection.");
linkedinConnector._getContentMetrics = async () => unavailable("LinkedIn post metrics are not part of this connection.");
linkedinConnector._publishContent = async () => unavailable("LinkedIn posting is not part of this connection.");

linkedinConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "LinkedIn") };
  }
  const creds = linkedinConnector.getAppCredentials();
  if (!creds.complete) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "LinkedIn app credentials are not configured." };
  }
  const tokenRes = await fetch(LINKEDIN_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) return classifyLinkedInFailure(tokenJson, tokenRes.status);
  storeLinkedInTokens(account.id, tokenJson, tokens.providerAccountId, tokens.refreshToken);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED };
};

linkedinConnector._disconnect = async (account) => {
  clearAccountTokens("linkedin", account?.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
