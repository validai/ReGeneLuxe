import { createHash, randomBytes } from "node:crypto";
import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { SOCIAL_CONNECTION_STATES } from "../../../src/data/statusContracts.js";
import { baseConnector, defaultRedirect, envCredentials, unavailable } from "../base.js";
import { canonicalOAuthRedirect } from "../../auth/origin.js";
import { createOAuthState, friendlyOAuthError } from "../oauth/state.js";
import { clearAccountTokens, setAccountTokens } from "../../secrets/providers.js";

const TIKTOK_AUTHORIZE = "https://www.tiktok.com/v2/auth/authorize/";
const TIKTOK_TOKEN = "https://open.tiktokapis.com/v2/oauth/token/";
const TIKTOK_USER = "https://open.tiktokapis.com/v2/user/info/";
const TIKTOK_SCOPE = "user.info.basic";
const TIKTOK_FIELDS = "open_id,union_id,avatar_url,display_name";

export const tiktokConnector = baseConnector({
  provider: "tiktok",
  displayName: "TikTok",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Create a TikTok developer app at developers.tiktok.com and add Login Kit for Desktop",
    "2. Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET. TikTok calls the client id a Client Key",
    `3. Register this exact callback: ${defaultRedirect("tiktok")}`,
    "4. Add the operator TikTok account as a sandbox target user. Do not add Content Posting API",
  ].join("\n"),
  envKeys: {
    clientId: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

tiktokConnector.getAppCredentials = () => {
  const creds = envCredentials("tiktok", {
    clientId: "TIKTOK_CLIENT_KEY",
    clientSecret: "TIKTOK_CLIENT_SECRET",
  });
  return {
    ...creds,
    redirectUri: canonicalOAuthRedirect(process.env.TIKTOK_REDIRECT_URI) || defaultRedirect("tiktok"),
  };
};

function tiktokPkce() {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("hex");
  return { verifier, challenge };
}

function errorBlob(json) {
  const err = json?.error;
  if (err && typeof err === "object") return `${err.code || ""} ${err.message || ""}`;
  return `${err || ""} ${json?.error_description || ""}`;
}

function failedTikTok(json) {
  const err = json?.error;
  if (!err) return false;
  if (typeof err === "object" && String(err.code || "ok") === "ok") return false;
  return true;
}

function classifyTikTokFailure(json, status) {
  const blob = errorBlob(json).toLowerCase();
  const base = { ok: false };
  if (status === 429 || /rate_limit|too many requests/.test(blob)) {
    return { ...base, code: "RATE_LIMITED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "TikTok rate limit reached. Try again shortly." };
  }
  if (/payment|billing|credits|paid plan/.test(blob)) {
    return { ...base, code: "PLAN_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "TikTok requires a paid plan for this request." };
  }
  if (/target user|sandbox|app review|not been approved|unaudited/.test(blob)) {
    return { ...base, code: "REVIEW_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "This TikTok account is not authorized for the sandbox app yet." };
  }
  if (/scope_not_authorized|scope_permission|permission/.test(blob)) {
    return { ...base, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "TikTok did not grant permission to read this profile." };
  }
  if (/invalid_client|client_key|client key/.test(blob)) {
    return { ...base, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "TikTok app credentials are not configured." };
  }
  if (status === 401 || /invalid_grant|access_token_invalid|expired/.test(blob)) {
    return { ...base, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "TikTok") };
  }
  if (status >= 500) {
    return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "TikTok is temporarily unavailable." };
  }
  return { ...base, code: "PROVIDER_ERROR", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "TikTok could not complete this connection." };
}

function profileFromUser(user, openId) {
  const id = String(user?.open_id || openId || "");
  return {
    providerAccountId: id,
    displayName: user?.display_name || "",
    handle: "",
    profileUrl: "",
    ...(user?.avatar_url ? { profileImageUrl: String(user.avatar_url) } : {}),
    ...(user?.union_id ? { unionId: String(user.union_id) } : {}),
  };
}

function storeTikTokTokens(accountKey, tokenJson, providerAccountId) {
  const expiresIn = Number(tokenJson.expires_in || 0);
  const scopes = String(tokenJson.scope || TIKTOK_SCOPE).split(/[,\s]+/).filter(Boolean);
  setAccountTokens("tiktok", accountKey, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt: expiresIn ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
    scopes,
    providerAccountId: providerAccountId || null,
  });
}

tiktokConnector._beginAuth = async ({ accountId, returnTo, operatorId = null, managedProfileId = null, connectionId = null }) => {
  const creds = tiktokConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return {
      ok: false,
      readiness: "SETUP_REQUIRED",
      reason: "SETUP_REQUIRED",
      code: "SETUP_REQUIRED",
      instructions: tiktokConnector.setupInstructions,
      message: "TikTok app credentials are not configured.",
    };
  }
  const { verifier, challenge } = tiktokPkce();
  const state = createOAuthState({
    provider: "tiktok",
    accountId,
    returnTo,
    operatorId,
    managedProfileId,
    connectionId: connectionId || accountId,
    pkceVerifier: verifier,
  });
  const url = new URL(TIKTOK_AUTHORIZE);
  url.searchParams.set("client_key", creds.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", TIKTOK_SCOPE);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { ok: true, authUrl: url.toString(), state };
};

tiktokConnector._completeAuth = async ({ code, stateMeta, error, errorDescription }) => {
  if (error) {
    const denied = String(error) === "access_denied";
    return {
      ok: false,
      code: denied ? "CANCELLED" : "PROVIDER_ERROR",
      connectionState: SOCIAL_CONNECTION_STATES.ERROR,
      error: friendlyOAuthError(error, "TikTok"),
      detail: denied ? "" : String(errorDescription || "").replace(/access_token|refresh_token|client_secret|code_verifier|code=[^&\s]+/gi, ""),
    };
  }
  const authorizationCode = String(code || "").trim();
  if (!authorizationCode) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("missing_code", "TikTok") };
  }
  const accountKey = stateMeta?.connectionId || stateMeta?.accountId;
  const verifier = String(stateMeta?.pkceVerifier || "");
  if (!accountKey || !verifier) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: friendlyOAuthError("invalid_grant", "TikTok") };
  }
  const creds = tiktokConnector.getAppCredentials();
  if (!creds.complete || !creds.redirectUri) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "TikTok app credentials are not configured." };
  }
  const tokenRes = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: creds.clientId,
      client_secret: creds.clientSecret,
      code: authorizationCode,
      grant_type: "authorization_code",
      redirect_uri: creds.redirectUri,
      code_verifier: verifier,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const token = tokenJson.data && tokenJson.data.access_token ? tokenJson.data : tokenJson;
  if (!tokenRes.ok || failedTikTok(tokenJson) || !token.access_token) return classifyTikTokFailure(tokenJson, tokenRes.status);
  const granted = String(token.scope || "");
  if (granted && !granted.split(/[,\s]+/).includes(TIKTOK_SCOPE)) {
    return { ok: false, code: "PERMISSION_MISSING", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "TikTok did not grant permission to read this profile." };
  }
  const profileUrl = new URL(TIKTOK_USER);
  profileUrl.searchParams.set("fields", TIKTOK_FIELDS);
  const infoRes = await fetch(profileUrl, { headers: { Authorization: `Bearer ${token.access_token}` } });
  const infoJson = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || failedTikTok(infoJson)) return classifyTikTokFailure(infoJson, infoRes.status);
  const profile = profileFromUser(infoJson.data?.user || {}, token.open_id);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No TikTok account was returned for this authorization." };
  }
  storeTikTokTokens(accountKey, token, profile.providerAccountId);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED, profile };
};

tiktokConnector._getProfile = async (_account, tokens) => {
  const profileUrl = new URL(TIKTOK_USER);
  profileUrl.searchParams.set("fields", TIKTOK_FIELDS);
  const res = await fetch(profileUrl, { headers: { Authorization: `Bearer ${tokens.accessToken}` } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || failedTikTok(json)) return classifyTikTokFailure(json, res.status);
  const profile = profileFromUser(json.data?.user || {}, tokens.providerAccountId);
  if (!profile.providerAccountId) {
    return { ok: false, code: "NO_DESTINATIONS", connectionState: SOCIAL_CONNECTION_STATES.ERROR, error: "No TikTok account was returned for this authorization." };
  }
  return { ok: true, profile };
};

tiktokConnector._getAccountMetrics = async () => unavailable("TikTok account metrics are not part of this connection.");
tiktokConnector._getContent = async () => unavailable("TikTok videos are not read for this connection.");
tiktokConnector._getContentMetrics = async () => unavailable("TikTok video metrics are not part of this connection.");
tiktokConnector._publishContent = async () => unavailable("TikTok publishing is not part of this connection.");

tiktokConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return { ok: false, code: "RECONNECT_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.RECONNECT_REQUIRED, error: friendlyOAuthError("invalid_grant", "TikTok") };
  }
  const creds = tiktokConnector.getAppCredentials();
  if (!creds.complete) {
    return { ok: false, code: "SETUP_REQUIRED", connectionState: SOCIAL_CONNECTION_STATES.SETUP_REQUIRED, error: "TikTok app credentials are not configured." };
  }
  const tokenRes = await fetch(TIKTOK_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: creds.clientId,
      client_secret: creds.clientSecret,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  const token = tokenJson.data && tokenJson.data.access_token ? tokenJson.data : tokenJson;
  if (!tokenRes.ok || failedTikTok(tokenJson) || !token.access_token) return classifyTikTokFailure(tokenJson, tokenRes.status);
  storeTikTokTokens(account.id, {
    ...token,
    refresh_token: token.refresh_token || tokens.refreshToken,
  }, tokens.providerAccountId || token.open_id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.CONNECTED };
};

tiktokConnector._disconnect = async (account) => {
  clearAccountTokens("tiktok", account.id);
  return { ok: true, connectionState: SOCIAL_CONNECTION_STATES.UNCONNECTED };
};
