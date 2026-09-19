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
import {
  assertMatchesBoundGoogleIdentity,
  boundGoogleEmail,
  googleIdentityMismatchMessage,
} from "../../src/data/googleIdentity.js";
import { bindProfileGoogleIdentity } from "../db/googleIdentityBinding.js";

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
    notes: "Gmail must use the same Google account as this profile.",
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
  const identity = assertMatchesBoundGoogleIdentity(activeProfile, {
    email: operator.email,
    googleSub: operator.googleSub,
  });
  if (!identity.ok) {
    return {
      ok: false,
      status: 403,
      error: identity.error,
      redirectTo: settingsRedirect({ gmail: "error", message: identity.error }),
    };
  }

  const connection = await ensureProfileConnection(activeProfile, PROFILE_CONNECTION_KINDS.GMAIL);
  const started = await gmailConnector.beginAuth({
    accountId: connection.id,
    connectionId: connection.id,
    managedProfileId: activeProfile.id,
    operatorId: operator.id,
    returnTo,
    loginHint: boundGoogleEmail(activeProfile, operator.email),
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
      error: "Gmail connection does not belong to this operator.",
      redirectTo: settingsRedirect({ gmail: "error", message: "Gmail connection does not belong to this operator." }),
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

  const identity = assertMatchesBoundGoogleIdentity(profile, {
    email: result.profile.email,
    googleSub: result.profile.googleAccountSub,
  });
  if (!identity.ok) {
    clearAccountTokens("gmail", connection.id);
    return {
      ok: false,
      connectionState: "ERROR",
      error: identity.error,
      redirectTo: settingsRedirect({ gmail: "error", message: identity.error || googleIdentityMismatchMessage(profile.googleAccountEmail) }),
    };
  }

  const saved = await upsertProfileConnection({
    ...connection,
    provider: "gmail",
    status: PROFILE_CONNECTION_STATES.CONNECTED,
    connectionState: PROFILE_CONNECTION_STATES.CONNECTED,
    googleAccountSub: result.profile.googleAccountSub || "",
    email: result.profile.email || "",
    grantedScopes: result.profile.grantedScopes || [],
    mailbox: result.profile.mailbox || null,
    connectedAt: nowIso(),
    lastSyncAt: nowIso(),
    notes: "",
    updatedAt: nowIso(),
  });
  if (!profile.googleAccountEmail || !profile.googleAccountSub) {
    await bindProfileGoogleIdentity(profile.id, {
      email: saved.email,
      googleSub: saved.googleAccountSub,
    });
  }

  return {
    ok: true,
    connectionState: "CONNECTED",
    connection: publicProfileConnection(saved),
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
  return {
    ok: true,
    connectionState: "CONNECTED",
    connection: publicProfileConnection(next),
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
  return publicProfileConnection(row) || publicProfileConnection({
    kind: PROFILE_CONNECTION_KINDS.GMAIL,
    provider: "gmail",
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    displayLabel: "Gmail",
  });
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
