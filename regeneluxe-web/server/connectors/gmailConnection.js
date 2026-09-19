import { gmailConnector } from "./providers/gmail.js";
import { consumeOAuthState } from "./oauth/state.js";
import { getCanonicalOrigin } from "../auth/origin.js";
import {
  clearAccountTokens,
  getAccountTokens,
  hasAccountTokens,
} from "../secrets/providers.js";
import {
  ensureProfileConnection,
  getManagedProfile,
  getProfileConnectionByKind,
  upsertProfileConnection,
} from "../db/managedProfileRepository.js";
import { list } from "../db/index.js";
import { COLLECTIONS } from "../db/collections.js";
import { PROFILE_CONNECTION_KINDS, PROFILE_CONNECTION_STATES, publicProfileConnection } from "../../src/data/profileModels.js";
import { nowIso } from "../../src/data/ids.js";
import { countGmailMessagesForProfile, gmailBrainSignals, syncGmailMessages } from "./gmailSync.js";
import { assertMatchesSignedInGoogleAccount } from "../../src/data/googleIdentity.js";

function absolutePath(path) {
  if (!path) return `${getCanonicalOrigin()}/settings`;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return new URL(path, getCanonicalOrigin()).toString();
}

function settingsRedirect(params = {}) {
  const url = new URL("/settings", getCanonicalOrigin());
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export function gmailSettingsRedirect(params = {}) {
  return settingsRedirect(params);
}

function disconnectedFields() {
  return {
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    email: "",
    googleAccountSub: "",
    grantedScopes: [],
    connectedAt: null,
    lastSyncAt: null,
    mailbox: null,
    notes: "Gmail is a profile connection on the signed-in ReGeneLuxe account.",
    lastErrorCode: "",
    lastErrorSummary: "",
    indexedCount: 0,
    pendingChannels: [],
    updatedAt: nowIso(),
  };
}

/**
 * @param {{ operator?: { id: string }, activeProfile?: object, returnTo?: string }} [input]
 */
export async function startGmailAuth({ operator, activeProfile, returnTo = "/settings" } = {}) {
  if (!operator?.id) {
    return { ok: false, status: 401, error: "Please sign in to continue.", redirectTo: absolutePath("/signin") };
  }
  if (!activeProfile?.id) {
    return { ok: false, status: 400, error: "Create a managed profile before connecting Gmail.", redirectTo: absolutePath("/setup/profile") };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return { ok: false, status: 403, error: "Gmail can only be connected for a profile you own.", redirectTo: settingsRedirect({ gmail: "error", message: "Gmail can only be connected for the active profile." }) };
  }

  const connection = await ensureProfileConnection(activeProfile, PROFILE_CONNECTION_KINDS.GMAIL);
  const started = await gmailConnector.beginAuth({
    accountId: connection.id,
    connectionId: connection.id,
    managedProfileId: activeProfile.id,
    operatorId: operator.id,
    returnTo,
    loginHint: operator.email || "",
  });

  if (!started.ok) {
    return {
      ...started,
      redirectTo: settingsRedirect({
        gmail: "error",
        message: started.message || started.error || "Gmail is not ready to connect.",
      }),
    };
  }

  return {
    ok: true,
    authUrl: started.authUrl,
    state: started.state,
    connectionId: connection.id,
    managedProfileId: activeProfile.id,
    redirectTo: started.authUrl,
  };
}

/**
 * @param {{ code?: string, state?: string, error?: string, errorDescription?: string, operator?: { id: string } }} [input]
 */
export async function completeGmailAuth({
  code,
  state,
  error,
  errorDescription,
  operator,
} = {}) {
  const stateResult = consumeOAuthState(state);
  if (!stateResult.ok) {
    return {
      ok: false,
      connectionState: "ERROR",
      error: stateResult.error,
      redirectTo: settingsRedirect({ gmail: "error", message: stateResult.error }),
    };
  }
  if (stateResult.provider && stateResult.provider !== "gmail") {
    return {
      ok: false,
      error: "This connection session is not for Gmail.",
      redirectTo: settingsRedirect({ gmail: "error", message: "This connection session is not for Gmail." }),
    };
  }
  if (!operator?.id) {
    return {
      ok: false,
      status: 401,
      error: "Please sign in to continue.",
      redirectTo: absolutePath("/signin"),
    };
  }
  if (stateResult.operatorId && stateResult.operatorId !== operator.id) {
    return {
      ok: false,
      error: "Gmail connection does not belong to this account.",
      redirectTo: settingsRedirect({ gmail: "error", message: "Gmail connection does not belong to this account." }),
    };
  }

  const managedProfileId = stateResult.managedProfileId;
  const profile = managedProfileId ? await getManagedProfile(managedProfileId) : null;
  if (!profile || profile.ownerOperatorId !== operator.id) {
    return {
      ok: false,
      error: "Gmail can only be attached to the authorizing managed profile.",
      redirectTo: settingsRedirect({ gmail: "error", message: "Gmail can only be attached to the authorizing managed profile." }),
    };
  }

  const connection = await ensureProfileConnection(profile, PROFILE_CONNECTION_KINDS.GMAIL);
  const result = await gmailConnector.completeAuth({
    code,
    state,
    stateMeta: { ...stateResult, accountId: connection.id, connectionId: connection.id },
    error,
    errorDescription,
  });

  if (!result.ok) {
    const status = result.connectionState || PROFILE_CONNECTION_STATES.ERROR;
    await upsertProfileConnection({
      ...connection,
      status,
      connectionState: status,
      notes: result.error || "Gmail connection failed.",
      updatedAt: nowIso(),
    });
    if (status !== PROFILE_CONNECTION_STATES.CONNECTED) {
      if (!hasAccountTokens("gmail", connection.id)) {
        clearAccountTokens("gmail", connection.id);
      }
    }
    return {
      ok: false,
      connectionState: status,
      error: result.error,
      redirectTo: settingsRedirect({ gmail: "error", message: result.error || "Gmail connection failed." }),
    };
  }

  const identity = assertMatchesSignedInGoogleAccount(operator, {
    googleSub: result.profile?.googleAccountSub,
    email: result.profile?.email,
  });
  if (!identity.ok) {
    clearAccountTokens("gmail", connection.id);
    await upsertProfileConnection({
      ...connection,
      ...disconnectedFields(),
      status: PROFILE_CONNECTION_STATES.ERROR,
      connectionState: PROFILE_CONNECTION_STATES.ERROR,
      lastErrorCode: "GOOGLE_ACCOUNT_MISMATCH",
      lastErrorSummary: identity.error,
      notes: identity.error,
    });
    return {
      ok: false,
      connectionState: PROFILE_CONNECTION_STATES.ERROR,
      error: identity.error,
      redirectTo: settingsRedirect({ gmail: "error", message: identity.error }),
    };
  }

  const attemptedAt = nowIso();
  const saved = await upsertProfileConnection({
    ...connection,
    provider: "gmail",
    service: "GOOGLE_GMAIL",
    status: PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
    googleAccountSub: result.profile.googleAccountSub || "",
    email: result.profile.email || "",
    externalEmail: result.profile.email || "",
    externalAccountId: result.profile.googleAccountSub || "",
    permission: "readonly",
    grantedScopes: result.profile.grantedScopes || [],
    mailbox: result.profile.mailbox || null,
    connectedAt: nowIso(),
    lastAttemptedSyncAt: attemptedAt,
    lastErrorCode: "",
    lastErrorSummary: "",
    notes: "",
    updatedAt: nowIso(),
  });
  const synced = await syncGmailMessages({ connection: saved }).catch((error) => ({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
    lastAttemptedSyncAt: attemptedAt,
  }));
  const next = await upsertProfileConnection({
    ...saved,
    indexedCount: synced.indexedCount || 0,
    lastAttemptedSyncAt: synced.lastAttemptedSyncAt || attemptedAt,
    lastSuccessfulSyncAt: synced.ok ? (synced.lastSuccessfulSyncAt || nowIso()) : saved.lastSuccessfulSyncAt,
    lastSyncAt: synced.ok ? (synced.lastSuccessfulSyncAt || nowIso()) : saved.lastSyncAt,
    lastErrorCode: synced.ok ? "" : (synced.code || "ERROR"),
    lastErrorSummary: synced.ok ? "" : (synced.error || ""),
    status: synced.connectionState === "SETUP_REQUIRED"
      ? PROFILE_CONNECTION_STATES.SETUP_REQUIRED
      : PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: synced.connectionState === "SETUP_REQUIRED"
      ? PROFILE_CONNECTION_STATES.SETUP_REQUIRED
      : PROFILE_CONNECTION_STATES.CONNECTED,
  });

  return {
    ok: true,
    connectionState: next.status,
    connection: publicProfileConnection(next),
    indexedCount: next.indexedCount,
    redirectTo: settingsRedirect({ gmail: "connected" }),
  };
}

async function loadOwnedGmailConnection(operator, activeProfile) {
  if (!operator?.id || !activeProfile?.id) {
    return { ok: false, status: 400, error: "Active profile required." };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return { ok: false, status: 403, error: "Gmail can only be managed for a profile you own." };
  }
  const connection = await getProfileConnectionByKind(activeProfile.id, PROFILE_CONNECTION_KINDS.GMAIL)
    || await ensureProfileConnection(activeProfile, PROFILE_CONNECTION_KINDS.GMAIL);
  return { ok: true, connection };
}

/**
 * @param {{ operator?: { id: string }, activeProfile?: object }} [input]
 */
export async function refreshGmailConnection({ operator, activeProfile } = {}) {
  const loaded = await loadOwnedGmailConnection(operator, activeProfile);
  if (!loaded.ok) return loaded;
  const { connection } = loaded;
  const tokens = getAccountTokens("gmail", connection.id);
  if (!tokens?.accessToken && !tokens?.refreshToken) {
    const next = await upsertProfileConnection({
      ...connection,
      ...disconnectedFields(),
      status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      connectionState: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    });
    return {
      ok: false,
      connectionState: "NOT_CONNECTED",
      error: "Gmail is not connected.",
      connection: publicProfileConnection(next),
    };
  }

  const expired = tokens.expiresAt && new Date(tokens.expiresAt).getTime() < Date.now() + 60_000;
  const account = { id: connection.id };
  let verified;
  if (!tokens.accessToken || expired) {
    verified = await gmailConnector._refreshAuth(account, tokens);
  } else {
    verified = await gmailConnector.getProfile(account);
    if (!verified.ok && tokens.refreshToken) {
      verified = await gmailConnector._refreshAuth(account, tokens);
    }
  }

  if (!verified.ok) {
    const status = verified.connectionState || PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED;
    const next = await upsertProfileConnection({
      ...connection,
      status,
      connectionState: status,
      notes: verified.error || "Gmail needs to be reconnected.",
      updatedAt: nowIso(),
    });
    return {
      ok: false,
      connectionState: status,
      error: verified.error || "Gmail needs to be reconnected.",
      connection: publicProfileConnection(next),
    };
  }

  const next = await upsertProfileConnection({
    ...connection,
    status: PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
    email: verified.profile.email || connection.email,
    googleAccountSub: verified.profile.googleAccountSub || connection.googleAccountSub,
    mailbox: verified.profile.mailbox || connection.mailbox,
    lastSyncAt: nowIso(),
    notes: "",
    updatedAt: nowIso(),
  });
  const attemptedAt = nowIso();
  const synced = await syncGmailMessages({ connection: next });
  const withSync = await upsertProfileConnection({
    ...next,
    lastAttemptedSyncAt: attemptedAt,
    lastSuccessfulSyncAt: synced.ok ? (synced.lastSuccessfulSyncAt || nowIso()) : next.lastSuccessfulSyncAt,
    lastSyncAt: synced.ok ? (synced.lastSuccessfulSyncAt || nowIso()) : next.lastSyncAt,
    indexedCount: synced.ok ? synced.indexedCount : next.indexedCount,
    lastErrorCode: synced.ok ? "" : (synced.code || ""),
    lastErrorSummary: synced.ok ? "" : (synced.error || ""),
  });
  return {
    ok: true,
    connectionState: "CONNECTED",
    connection: publicProfileConnection(withSync),
    indexedCount: withSync.indexedCount,
  };
}

/**
 * @param {{ operator?: { id: string }, activeProfile?: object }} [input]
 */
export async function disconnectGmailConnection({ operator, activeProfile } = {}) {
  const loaded = await loadOwnedGmailConnection(operator, activeProfile);
  if (!loaded.ok) return loaded;
  const { connection } = loaded;
  await gmailConnector.disconnect({ id: connection.id });
  const next = await upsertProfileConnection({
    ...connection,
    ...disconnectedFields(),
  });

  const profileStillThere = await getManagedProfile(activeProfile.id);
  return {
    ok: true,
    connectionState: "NOT_CONNECTED",
    connection: publicProfileConnection(next),
    profilePreserved: Boolean(profileStillThere),
    profileId: activeProfile.id,
  };
}

export async function publicGmailForProfile(managedProfileId) {
  const row = managedProfileId
    ? await getProfileConnectionByKind(managedProfileId, PROFILE_CONNECTION_KINDS.GMAIL)
    : null;
  const publicRow = publicProfileConnection(row) || publicProfileConnection({
    kind: PROFILE_CONNECTION_KINDS.GMAIL,
    provider: "gmail",
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    displayLabel: "Gmail",
    permission: "readonly",
  });
  if (publicRow && managedProfileId) {
    publicRow.indexedCount = publicRow.indexedCount || await countGmailMessagesForProfile(managedProfileId);
    publicRow.brain = gmailBrainSignals(publicRow, publicRow.indexedCount);
  }
  return publicRow;
}

/** Defense: tokens must never appear on ordinary connection rows. */
export function connectionRowExposesSecrets(row) {
  if (!row || typeof row !== "object") return false;
  const serialized = JSON.stringify(row);
  return /accessToken|refreshToken|"token"|clientSecret/.test(serialized);
}

export async function assertProfileNotDeleted(profileId) {
  return Boolean(await getManagedProfile(profileId));
}

export async function listCampaignsForProfile(profileId) {
  const rows = await list(COLLECTIONS.campaigns);
  return rows.filter((row) => row.managedProfileId === profileId);
}
