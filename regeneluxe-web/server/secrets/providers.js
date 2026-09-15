import { readSecrets, writeSecrets } from "../secrets.js";
import { decryptSecret, encryptSecret } from "./crypto.js";

/**
 * Provider token vault — server-only.
 * Tokens never enter entities, backups (stripped), React props, or Campaign Brain context.
 */

function providerKey(provider, accountId) {
  return `${String(provider).toLowerCase()}::${accountId || "_app"}`;
}

export function listProviderCredentialKeys() {
  const secrets = readSecrets();
  return Object.keys(secrets.providers || {});
}

export function getProviderAppCredentials(provider) {
  const secrets = readSecrets();
  const app = secrets.providers?.[`${String(provider).toLowerCase()}::app`];
  if (!app) return null;
  return {
    clientId: app.clientId || null,
    clientSecret: app.clientSecret ? decryptSecret(app.clientSecret) : null,
    redirectUri: app.redirectUri || null,
    extra: app.extra || {},
  };
}

export function setProviderAppCredentials(provider, {
  clientId = "",
  clientSecret = "",
  redirectUri = "",
  extra = {},
} = {}) {
  const secrets = readSecrets();
  secrets.providers = secrets.providers || {};
  const key = `${String(provider).toLowerCase()}::app`;
  secrets.providers[key] = {
    clientId,
    clientSecret: clientSecret ? encryptSecret(clientSecret) : "",
    redirectUri,
    extra,
    updatedAt: new Date().toISOString(),
  };
  writeSecrets(secrets);
  return true;
}

export function getAccountTokens(provider, accountId) {
  const secrets = readSecrets();
  const row = secrets.providers?.[providerKey(provider, accountId)];
  if (!row) return null;
  return {
    accessToken: row.accessToken ? decryptSecret(row.accessToken) : null,
    refreshToken: row.refreshToken ? decryptSecret(row.refreshToken) : null,
    expiresAt: row.expiresAt || null,
    scopes: row.scopes || [],
    providerAccountId: row.providerAccountId || null,
    updatedAt: row.updatedAt || null,
  };
}

export function setAccountTokens(provider, accountId, {
  accessToken,
  refreshToken,
  expiresAt = null,
  scopes = [],
  providerAccountId = null,
} = {}) {
  if (!accountId) throw new Error("accountId required for token storage");
  const secrets = readSecrets();
  secrets.providers = secrets.providers || {};
  const key = providerKey(provider, accountId);
  const prev = secrets.providers[key] || {};
  secrets.providers[key] = {
    ...prev,
    accessToken: accessToken != null ? encryptSecret(accessToken) : prev.accessToken,
    refreshToken: refreshToken != null ? encryptSecret(refreshToken) : prev.refreshToken,
    expiresAt,
    scopes,
    providerAccountId,
    updatedAt: new Date().toISOString(),
  };
  writeSecrets(secrets);
  return true;
}

export function clearAccountTokens(provider, accountId) {
  const secrets = readSecrets();
  if (!secrets.providers) return false;
  delete secrets.providers[providerKey(provider, accountId)];
  writeSecrets(secrets);
  return true;
}

export function hasAccountTokens(provider, accountId) {
  const tokens = getAccountTokens(provider, accountId);
  return Boolean(tokens?.accessToken);
}

/** Public, safe metadata for status APIs — never includes token material. */
export function publicProviderVaultStatus() {
  const secrets = readSecrets();
  const providers = secrets.providers || {};
  const accounts = [];
  const apps = [];
  for (const [key, value] of Object.entries(providers)) {
    if (key.endsWith("::app")) {
      apps.push({
        provider: key.replace(/::app$/, ""),
        configured: Boolean(value?.clientId),
      });
    } else if (value?.accessToken) {
      const [provider, accountId] = key.split("::");
      accounts.push({
        provider,
        accountId,
        hasToken: true,
        expiresAt: value.expiresAt || null,
        scopes: value.scopes || [],
        updatedAt: value.updatedAt || null,
      });
    }
  }
  return { apps, accounts };
}
