import { stripSecretFields } from "../../src/data/secretFields.js";

export const IDENTITY_LOCK_FIELDS = [
  "ownerOperatorId",
  "googleSub",
  "googleAccountSub",
  "managedProfileId",
  "accessToken",
  "refreshToken",
  "token",
  "clientSecret",
  "apiKey",
  "AUTH_SECRET",
  "TURSO_AUTH_TOKEN",
  "authToken",
];

export const CONNECTION_LOCK_FIELDS = [
  "connectionState",
  "connectionMethod",
  "grantedScopes",
  "lastSuccessfulSync",
  "lastSuccessfulSyncAt",
  "providerAccountId",
];

export const META_WRITE_ALLOWLIST = new Set([
  "active_campaign_id",
  "working_account_id",
  "active_profile_id",
]);

export const FORBIDDEN_WRITE_FIELDS = [
  "ownerOperatorId",
  "googleSub",
  "googleAccountSub",
  "activeProfileId",
  "managedProfileId",
  "accessToken",
  "refreshToken",
  "token",
  "clientSecret",
  "apiKey",
  "AUTH_SECRET",
  "TURSO_AUTH_TOKEN",
  "authToken",
  "role",
];

export function stripForbiddenWriteFields(record = {}) {
  const next = { ...record };
  for (const key of FORBIDDEN_WRITE_FIELDS) delete next[key];
  return next;
}

export function pickLockedFields(source, keys) {
  const out = {};
  if (!source) return out;
  for (const key of keys) {
    if (source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/**
 * @param {object} incoming
 * @param {object | null} [existing]
 * @returns {object}
 */
export function lockIdentityFields(incoming = {}, existing = null) {
  const next = stripSecretFields({ ...incoming });
  for (const key of IDENTITY_LOCK_FIELDS) delete next[key];
  if (existing) Object.assign(next, pickLockedFields(existing, IDENTITY_LOCK_FIELDS));
  return next;
}

/**
 * @param {object} incoming
 * @param {object | null} [existing]
 * @returns {object}
 */
export function lockConnectionFields(incoming = {}, existing = null) {
  const next = { ...incoming };
  if (existing) {
    Object.assign(next, pickLockedFields(existing, CONNECTION_LOCK_FIELDS));
  } else if (next.connectionState === "CONNECTED") {
    next.connectionState = "UNCONNECTED";
  }
  return next;
}

export function applyRemoteRecord(collection, local, remote) {
  const incoming = stripSecretFields(remote || {});
  if (!local) return incoming;
  return {
    ...incoming,
    id: local.id,
    ...pickLockedFields(local, IDENTITY_LOCK_FIELDS),
    ...(collection === "operators" ? { googleSub: local.googleSub, email: local.email } : {}),
  };
}

export function isAllowedMetaKey(key) {
  return META_WRITE_ALLOWLIST.has(String(key || ""));
}
