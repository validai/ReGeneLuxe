/**
 * Honest YouTube credential capability derivation.
 * Never infer upload/publish from connector implementation alone.
 */

import { YOUTUBE_UPLOAD_SCOPE } from "../auth/googleScopes.js";
import { getAccountTokens, publicProviderVaultStatus } from "../secrets/providers.js";

export const YOUTUBE_PERMISSION = Object.freeze({
  NONE: "none",
  READONLY: "readonly",
  UPLOAD: "upload",
});

export function normalizeScopeList(scopes = []) {
  if (typeof scopes === "string") {
    return [...new Set(scopes.split(/\s+/).map((s) => s.trim()).filter(Boolean))];
  }
  return [...new Set((Array.isArray(scopes) ? scopes : []).map((s) => String(s || "").trim()).filter(Boolean))];
}

export function mergeScopeLists(...lists) {
  const out = new Set();
  for (const list of lists) {
    for (const scope of normalizeScopeList(list)) out.add(scope);
  }
  return [...out].sort();
}

export function hasYoutubeUploadScope(scopes = []) {
  return normalizeScopeList(scopes).includes(YOUTUBE_UPLOAD_SCOPE);
}

export function hasYoutubeReadonlyScope(scopes = []) {
  const set = new Set(normalizeScopeList(scopes));
  return set.has("https://www.googleapis.com/auth/youtube.readonly")
    || set.has("https://www.googleapis.com/auth/youtube")
    || set.has(YOUTUBE_UPLOAD_SCOPE);
}

export function permissionFromScopes(scopes = []) {
  const list = normalizeScopeList(scopes);
  if (!list.length) return YOUTUBE_PERMISSION.NONE;
  if (hasYoutubeUploadScope(list)) return YOUTUBE_PERMISSION.UPLOAD;
  if (hasYoutubeReadonlyScope(list)) return YOUTUBE_PERMISSION.READONLY;
  return YOUTUBE_PERMISSION.NONE;
}

export function permissionLabel(permission) {
  switch (permission) {
    case YOUTUBE_PERMISSION.UPLOAD:
      return "Upload + read";
    case YOUTUBE_PERMISSION.READONLY:
      return "Read only";
    default:
      return "None";
  }
}

/**
 * Resolve vault token row for YouTube across Settings connection id and social account id.
 */
export function resolveYoutubeVaultTokens({ accountId = null, connectionId = null } = {}) {
  const candidates = [connectionId, accountId].filter(Boolean);
  for (const id of candidates) {
    const tokens = getAccountTokens("youtube", id);
    if (tokens?.accessToken || tokens?.refreshToken || (tokens?.scopes || []).length) {
      return { accountId: id, tokens, scopes: normalizeScopeList(tokens.scopes || []) };
    }
  }
  const publicRows = publicProviderVaultStatus().accounts.filter((row) => row.provider === "youtube");
  for (const id of candidates) {
    const row = publicRows.find((item) => item.accountId === id);
    if (row) {
      return { accountId: id, tokens: null, scopes: normalizeScopeList(row.scopes || []) };
    }
  }
  return { accountId: null, tokens: null, scopes: [] };
}

/**
 * Full truth model for one workspace YouTube binding.
 */
export function buildYoutubeCredentialTruth({
  account = null,
  connection = null,
  publishImplemented = false,
  controlledRealTestPassed = false,
} = {}) {
  const vault = resolveYoutubeVaultTokens({
    accountId: account?.id || null,
    connectionId: connection?.id || null,
  });
  const scopes = vault.scopes.length
    ? vault.scopes
    : normalizeScopeList(connection?.grantedScopes || account?.scopes || []);
  const permission = permissionFromScopes(scopes);
  const uploadScopePresent = hasYoutubeUploadScope(scopes);
  const identityConnected = Boolean(
    (account?.connectionState === "CONNECTED" || connection?.connectionState === "CONNECTED" || connection?.status === "CONNECTED")
    && (account?.providerAccountId || account?.externalAccountId || account?.channelId || connection?.channelId || connection?.externalAccountId),
  );
  const readConnected = identityConnected && (hasYoutubeReadonlyScope(scopes) || Boolean(vault.tokens || scopes.length));
  const publishCapable = Boolean(publishImplemented && uploadScopePresent && identityConnected && scopes.length);
  const scheduleCapable = publishCapable; // publishAt supported in upload helper once upload scope exists
  const certified = Boolean(controlledRealTestPassed && publishCapable);

  return {
    scopes,
    permission,
    permissionLabel: permissionLabel(permission),
    vaultAccountId: vault.accountId,
    vaultHealthy: Boolean(vault.accountId && (vault.tokens || scopes.length)),
    PUBLISH_IMPLEMENTED: Boolean(publishImplemented),
    UPLOAD_SCOPE_PRESENT: uploadScopePresent,
    IDENTITY_CONNECTED: identityConnected,
    READ_CONNECTED: readConnected,
    PUBLISH_CAPABLE: publishCapable,
    SCHEDULE_CAPABLE: scheduleCapable,
    CERTIFIED: certified,
  };
}
