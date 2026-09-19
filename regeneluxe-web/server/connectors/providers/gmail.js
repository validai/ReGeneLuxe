import { CAPABILITY, PROVIDER_READINESS } from "../capabilities.js";
import { baseConnector, envCredentials, unavailable } from "../base.js";
import { createOAuthState, friendlyOAuthError, pkcePair } from "../oauth/state.js";
import { clearAccountTokens, getAccountTokens, setAccountTokens } from "../../secrets/providers.js";
import { readSecrets, writeSecrets } from "../../secrets.js";
import { gmailCallbackUrl } from "../../auth/origin.js";
import {
  GMAIL_CONNECTION_SCOPE_STRING,
  GMAIL_READONLY_SCOPE,
} from "../../auth/googleScopes.js";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GMAIL_PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

function parseScopes(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasGmailReadonly(scopes) {
  return parseScopes(scopes).includes(GMAIL_READONLY_SCOPE);
}

export const gmailConnector = baseConnector({
  provider: "gmail",
  displayName: "Gmail",
  readiness: PROVIDER_READINESS.IMPLEMENTED,
  setupInstructions: [
    "1. Enable the Gmail API on the ReGeneLuxe Google Cloud project",
    "2. Add gmail.readonly to the OAuth consent screen",
    "3. Reuse AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET (operator login client)",
    `4. Add redirect URI: ${gmailCallbackUrl()}`,
  ].join("\n"),
  envKeys: {
    clientId: "AUTH_GOOGLE_ID",
    clientSecret: "AUTH_GOOGLE_SECRET",
  },
  capabilities: [
    CAPABILITY.READ_PROFILE,
  ],
});

gmailConnector.getAppCredentials = () => {
  const primary = envCredentials("gmail", {
    clientId: "AUTH_GOOGLE_ID",
    clientSecret: "AUTH_GOOGLE_SECRET",
  });
  if (primary.complete) {
    return { ...primary, redirectUri: gmailCallbackUrl() };
  }
  const fallback = envCredentials("gmail", {
    clientId: "GOOGLE_CLIENT_ID",
    clientSecret: "GOOGLE_CLIENT_SECRET",
  });
  return { ...fallback, redirectUri: gmailCallbackUrl() };
};

gmailConnector.resolveReadiness = () => (
  gmailConnector.getAppCredentials().complete
    ? PROVIDER_READINESS.IMPLEMENTED
    : PROVIDER_READINESS.SETUP_REQUIRED
);

gmailConnector._beginAuth = async ({
  accountId,
  returnTo = "/settings",
  managedProfileId,
  operatorId,
  connectionId,
  loginHint = "",
} = {}) => {
  const creds = gmailConnector.getAppCredentials();
  const { verifier, challenge } = pkcePair();
  const state = createOAuthState({
    provider: "gmail",
    accountId,
    returnTo,
    managedProfileId,
    operatorId,
    connectionId: connectionId || accountId,
  });
  const secrets = readSecrets();
  secrets.oauthPkce = secrets.oauthPkce || {};
  secrets.oauthPkce[state] = verifier;
  writeSecrets(secrets);

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", creds.clientId);
  url.searchParams.set("redirect_uri", creds.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_CONNECTION_SCOPE_STRING);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (loginHint) url.searchParams.set("login_hint", loginHint);
  return { ok: true, authUrl: url.toString(), state };
};

async function exchangeCode({ code, state }) {
  const creds = gmailConnector.getAppCredentials();
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

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "Gmail"),
      detail: tokenJson.error_description || tokenJson.error || "Token exchange failed",
    };
  }
  return { ok: true, tokenJson };
}

async function fetchUserInfo(accessToken) {
  const res = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, error: json.error_description || json.error || "Could not read Google account." };
  }
  return { ok: true, profile: json };
}

async function fetchGmailProfile(accessToken) {
  const res = await fetch(GMAIL_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      connectionState: res.status === 401 || res.status === 403 ? "RECONNECT_REQUIRED" : "ERROR",
      error: json.error?.message || "Gmail mailbox verification failed.",
    };
  }
  return { ok: true, profile: json };
}

function mailboxFromProfile(profile = {}) {
  return {
    emailAddress: profile.emailAddress || "",
    messagesTotal: Number.isFinite(Number(profile.messagesTotal)) ? Number(profile.messagesTotal) : null,
    threadsTotal: Number.isFinite(Number(profile.threadsTotal)) ? Number(profile.threadsTotal) : null,
    historyId: profile.historyId != null ? String(profile.historyId) : "",
  };
}

gmailConnector._completeAuth = async ({ code, stateMeta, error, errorDescription, state }) => {
  if (error) {
    const denied = error === "access_denied";
    return {
      ok: false,
      connectionState: denied ? "NOT_CONNECTED" : "ERROR",
      error: friendlyOAuthError(error, "Gmail"),
      detail: errorDescription || error,
    };
  }
  if (!code) {
    return { ok: false, connectionState: "ERROR", error: friendlyOAuthError("missing_code", "Gmail") };
  }

  const exchanged = await exchangeCode({ code, state });
  if (!exchanged.ok) return exchanged;
  const tokenJson = exchanged.tokenJson;
  const grantedScopes = parseScopes(tokenJson.scope || GMAIL_CONNECTION_SCOPE_STRING);
  if (!hasGmailReadonly(grantedScopes)) {
    return {
      ok: false,
      connectionState: "ERROR",
      error: "Gmail was not granted read access. Approve gmail.readonly and try again.",
    };
  }

  const userinfo = await fetchUserInfo(tokenJson.access_token);
  if (!userinfo.ok) {
    return { ok: false, connectionState: "ERROR", error: userinfo.error };
  }

  const mailbox = await fetchGmailProfile(tokenJson.access_token);
  if (!mailbox.ok) {
    return {
      ok: false,
      connectionState: mailbox.connectionState || "ERROR",
      error: mailbox.error,
    };
  }

  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
    : null;
  const connectionId = stateMeta?.connectionId || stateMeta?.accountId;
  setAccountTokens("gmail", connectionId, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || null,
    expiresAt,
    scopes: grantedScopes,
    providerAccountId: userinfo.profile.sub || mailbox.profile.emailAddress || null,
  });

  return {
    ok: true,
    connectionState: "CONNECTED",
    profile: {
      googleAccountSub: userinfo.profile.sub || "",
      email: mailbox.profile.emailAddress || userinfo.profile.email || "",
      grantedScopes,
      mailbox: mailboxFromProfile(mailbox.profile),
    },
  };
};

gmailConnector._getProfile = async (_account, tokens) => {
  const mailbox = await fetchGmailProfile(tokens.accessToken);
  if (!mailbox.ok) return mailbox;
  const userinfo = await fetchUserInfo(tokens.accessToken);
  return {
    ok: true,
    profile: {
      googleAccountSub: userinfo.ok ? (userinfo.profile.sub || "") : "",
      email: mailbox.profile.emailAddress || (userinfo.ok ? userinfo.profile.email : "") || "",
      mailbox: mailboxFromProfile(mailbox.profile),
    },
  };
};

gmailConnector._refreshAuth = async (account, tokens) => {
  if (!tokens?.refreshToken) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: "Gmail needs to be reconnected.",
    };
  }
  const creds = gmailConnector.getAppCredentials();
  const body = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    refresh_token: tokens.refreshToken,
    grant_type: "refresh_token",
  });
  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson = await tokenRes.json().catch(() => ({}));
  if (!tokenRes.ok || !tokenJson.access_token) {
    return {
      ok: false,
      connectionState: "RECONNECT_REQUIRED",
      error: friendlyOAuthError("invalid_grant", "Gmail"),
      detail: tokenJson.error_description || tokenJson.error || "Token refresh failed",
    };
  }
  const expiresAt = tokenJson.expires_in
    ? new Date(Date.now() + Number(tokenJson.expires_in) * 1000).toISOString()
    : tokens.expiresAt;
  const scopes = parseScopes(tokenJson.scope || tokens.scopes?.join(" ") || GMAIL_CONNECTION_SCOPE_STRING);
  setAccountTokens("gmail", account.id, {
    accessToken: tokenJson.access_token,
    refreshToken: tokenJson.refresh_token || tokens.refreshToken,
    expiresAt,
    scopes,
    providerAccountId: tokens.providerAccountId || null,
  });
  return gmailConnector.getProfile(account);
};

gmailConnector._getContent = async () => unavailable("Gmail mailbox ingestion is not enabled.");
gmailConnector._getMessages = async () => unavailable("Gmail mailbox ingestion is not enabled.");

gmailConnector._disconnect = async (account) => {
  const tokens = getAccountTokens("gmail", account?.id);
  const token = tokens?.accessToken || tokens?.refreshToken;
  if (token) {
    try {
      await fetch(REVOKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token }),
      });
    } catch {
      // local disconnect still proceeds
    }
  }
  clearAccountTokens("gmail", account?.id);
  return { ok: true, connectionState: "NOT_CONNECTED" };
};
