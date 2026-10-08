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
import { list, JOB_TYPES } from "../db/index.js";
import { COLLECTIONS } from "../db/collections.js";
import { PROFILE_CONNECTION_KINDS, PROFILE_CONNECTION_STATES, publicProfileConnection } from "../../src/data/profileModels.js";
import { nowIso } from "../../src/data/ids.js";
import { countGmailMessagesForProfile, displayGmailJobStatus, enqueueGmailSync, gmailBrainSignals, latestGmailSyncJob, verifyGmailAccess } from "./gmailSync.js";
import { assertMatchesSignedInGoogleAccount } from "../../src/data/googleIdentity.js";
import { processJobQueue } from "../jobs/worker.js";

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
    jobStatus: "Idle",
    syncState: "Idle",
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
    return { ok: false, status: 400, error: "Finish account setup before connecting Gmail.", redirectTo: absolutePath("/setup/profile") };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return { ok: false, status: 403, error: "Gmail can only be connected for an account you own.", redirectTo: settingsRedirect({ gmail: "error", message: "Gmail can only be connected for this account." }) };
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
      error: "Gmail can only be attached to this ReGeneLuxe account.",
      redirectTo: settingsRedirect({ gmail: "error", message: "Gmail can only be attached to this ReGeneLuxe account." }),
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
    lastAttemptedSyncAt: nowIso(),
    lastErrorCode: "",
    lastErrorSummary: "",
    jobStatus: "Idle",
    notes: "",
    updatedAt: nowIso(),
  });
  const next = await runGmailSyncAndWait(saved);

  return {
    ok: true,
    connectionState: next.status,
    connection: publicProfileConnection(next),
    indexedCount: next.indexedCount,
    redirectTo: settingsRedirect({ gmail: "connected" }),
  };
}

async function runGmailSyncAndWait(connection) {
  await upsertProfileConnection({
    ...connection,
    status: PROFILE_CONNECTION_STATES.SYNCING,
    connectionState: PROFILE_CONNECTION_STATES.SYNCING,
    jobStatus: "Syncing",
    syncState: "Syncing",
    lastAttemptedSyncAt: nowIso(),
    lastErrorCode: "",
    lastErrorSummary: "",
    updatedAt: nowIso(),
  });
  await enqueueGmailSync(connection);
  await processJobQueue({
    types: [JOB_TYPES.SYNC_GMAIL],
    limit: 5,
    authz: { activeProfile: { id: connection.managedProfileId } },
  });
  return getProfileConnectionByKind(connection.managedProfileId, PROFILE_CONNECTION_KINDS.GMAIL);
}

async function loadOwnedGmailConnection(operator, activeProfile) {
  if (!operator?.id || !activeProfile?.id) {
    return { ok: false, status: 400, error: "Account workspace required." };
  }
  if (activeProfile.ownerOperatorId && activeProfile.ownerOperatorId !== operator.id) {
    return { ok: false, status: 403, error: "Gmail can only be managed for an account you own." };
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

  const verified = await verifyGmailAccess({ connection, operator });
  if (!verified.ok) {
    const status = verified.connectionState || PROFILE_CONNECTION_STATES.RECONNECT_REQUIRED;
    const next = await upsertProfileConnection({
      ...connection,
      status,
      connectionState: status,
      lastErrorCode: verified.code || status,
      lastErrorSummary: verified.error || "Gmail needs to be reconnected.",
      notes: verified.error || "Gmail needs to be reconnected.",
      jobStatus: verified.retryable ? "Retry" : "Error",
      updatedAt: nowIso(),
    });
    return {
      ok: false,
      connectionState: status,
      error: verified.error || "Gmail needs to be reconnected.",
      connection: publicProfileConnection(next),
    };
  }

  const ready = await upsertProfileConnection({
    ...connection,
    status: PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
    email: verified.profile.email || connection.email,
    googleAccountSub: verified.profile.googleAccountSub || connection.googleAccountSub,
    mailbox: verified.profile.mailbox || connection.mailbox,
    notes: "",
    updatedAt: nowIso(),
  });
  const withSync = await runGmailSyncAndWait(ready);
  const usable = withSync.status === PROFILE_CONNECTION_STATES.CONNECTED
    || withSync.status === PROFILE_CONNECTION_STATES.SYNCING;
  return {
    ok: usable,
    connectionState: withSync.status,
    error: usable ? undefined : withSync.lastErrorSummary,
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
  const preservedCount = await countGmailMessagesForProfile(activeProfile.id);
  return {
    ok: true,
    connectionState: "NOT_CONNECTED",
    connection: publicProfileConnection(next),
    profilePreserved: Boolean(profileStillThere),
    recordsPreserved: preservedCount,
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
    const counted = await countGmailMessagesForProfile(managedProfileId);
    publicRow.indexedCount = Math.max(Number(publicRow.indexedCount) || 0, counted);
    const job = await latestGmailSyncJob(publicRow.id);
    if (publicRow.status === PROFILE_CONNECTION_STATES.SYNCING) {
      publicRow.jobStatus = "Syncing";
    } else if (job) {
      const fromJob = displayGmailJobStatus(job);
      publicRow.jobStatus = fromJob === "Idle" ? (publicRow.jobStatus || "Idle") : fromJob;
    } else {
      publicRow.jobStatus = publicRow.jobStatus || "Idle";
    }
    publicRow.brain = gmailBrainSignals(publicRow);
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
