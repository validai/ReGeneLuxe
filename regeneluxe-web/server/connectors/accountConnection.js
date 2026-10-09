import { getConnector } from "./registry.js";
import { clearAccountTokens, getAccountTokens, setAccountTokens } from "../secrets/providers.js";
import { initDb, get, list, upsert, COLLECTIONS } from "../db/index.js";
import { emptyAccount } from "../../src/data/models.js";
import { nowIso } from "../../src/data/ids.js";
import { publicDestinationsFromPages } from "./providers/metaGraph.js";
import {
  clearConnectionSession,
  createConnectionSession,
  getConnectionSession,
  publicConnectionSession,
  updateConnectionSession,
} from "./connectionSession.js";
import {
  connectProvider,
  destinationsFromAuthResult,
  failureFromAuth,
  isConnectionSessionId,
  metaDestinationsFromPages,
  planConnectionConfirmation,
  readinessForProvider,
} from "../../src/data/connectionFlow.js";

function stripAccount(account) {
  const next = { ...account };
  delete next.accessToken;
  delete next.refreshToken;
  delete next.token;
  delete next.clientSecret;
  delete next.pageAccessToken;
  delete next.raw;
  return next;
}

function publicAccounts(rows, workspaceId) {
  return (rows || []).filter((account) => {
    if (!workspaceId || !account?.managedProfileId) return true;
    return account.managedProfileId === workspaceId;
  }).map((account) => stripAccount(account));
}

export function getAccountConnectionReadiness(provider) {
  const spec = connectProvider(provider);
  if (!spec) return { readiness: "UNSUPPORTED", label: "Unsupported", live: false };
  if (!spec.live) return { readiness: "UNSUPPORTED", label: "Unsupported", live: false };
  const connector = getConnector(provider);
  const readiness = connector.resolveReadiness?.() || connector.readiness || "UNSUPPORTED";
  return { ...readinessForProvider(provider, [{ provider, readiness }]), live: true };
}

/**
 * @param {{
 *   provider?: string,
 *   operatorId?: string | null,
 *   workspaceId?: string | null,
 *   workspaceName?: string,
 * }} [input]
 */
export async function startAccountConnection({
  provider,
  operatorId,
  workspaceId,
  workspaceName = "",
} = {}) {
  const spec = connectProvider(provider);
  if (!spec?.live) {
    return { ok: false, failure: "unavailable", readiness: "UNSUPPORTED", message: "This provider is not available yet." };
  }
  const connector = getConnector(provider);
  const readiness = connector.resolveReadiness?.() || connector.readiness;
  if (readiness !== "IMPLEMENTED") {
    return {
      ok: false,
      failure: failureFromAuth({ readiness, reason: readiness }),
      readiness,
      message: connector.setupInstructions || "",
    };
  }
  const session = createConnectionSession({
    provider: spec.id,
    operatorId,
    workspaceId,
    workspaceName,
  });
  const started = await connector.beginAuth({
    accountId: session.id,
    connectionId: session.id,
    returnTo: `/accounts?connect=select&session=${session.id}`,
    operatorId,
    managedProfileId: workspaceId,
    includeUpload: spec.id === "youtube",
  });
  if (!started?.ok || !started.authUrl) {
    clearConnectionSession(session.id);
    return {
      ok: false,
      failure: failureFromAuth(started || {}),
      readiness: started?.readiness || readiness,
      message: started?.message || "Could not start this connection.",
    };
  }
  updateConnectionSession(session.id, { oauthStateRef: started.state ? "issued" : null, status: "authorizing" });
  return {
    ok: true,
    authUrl: started.authUrl,
    session: publicConnectionSession(getConnectionSession(session.id)),
  };
}

export function destinationsForCompletedAuth(provider, result, tokens) {
  if (provider === "instagram" || provider === "facebook") {
    const pages = publicDestinationsFromPages(tokens?.pages || []);
    const discovered = metaDestinationsFromPages(pages);
    if (discovered.length) return discovered;
  }
  return destinationsFromAuthResult(provider, result);
}

/**
 * @param {{
 *   provider?: string,
 *   sessionId?: string,
 *   operatorId?: string | null,
 *   workspaceId?: string | null,
 *   result?: object,
 *   cancelled?: boolean,
 * }} [input]
 */
export async function recordConnectionCallback({
  provider,
  sessionId,
  operatorId,
  workspaceId,
  result,
  cancelled = false,
} = {}) {
  const session = getConnectionSession(sessionId);
  if (!session) return { ok: false, failure: "expired" };
  if (session.operatorId && operatorId && session.operatorId !== operatorId) {
    return { ok: false, failure: "workspace" };
  }
  if (session.workspaceId && workspaceId && session.workspaceId !== workspaceId) {
    return { ok: false, failure: "workspace" };
  }
  if (cancelled) {
    clearAccountTokens(provider, session.id);
    updateConnectionSession(session.id, { status: "cancelled", failure: "cancelled", destinations: [] });
    return { ok: false, failure: "cancelled", session: publicConnectionSession(getConnectionSession(session.id)) };
  }
  if (!result?.ok) {
    const failure = failureFromAuth(result || {});
    updateConnectionSession(session.id, { status: "failed", failure, destinations: [] });
    return { ok: false, failure, session: publicConnectionSession(getConnectionSession(session.id)) };
  }
  const tokens = getAccountTokens(provider, session.id);
  const destinations = destinationsForCompletedAuth(provider, result, tokens);
  updateConnectionSession(session.id, {
    status: "selecting",
    failure: destinations.length ? "" : "none",
    destinations,
    selectedIds: [],
  });
  if (!destinations.length) {
    return { ok: false, failure: "none", session: publicConnectionSession(getConnectionSession(session.id)) };
  }
  return { ok: true, session: publicConnectionSession(getConnectionSession(session.id)) };
}

function relocateTokens(fromProvider, fromId, toProvider, toId, externalId) {
  const tokens = getAccountTokens(fromProvider, fromId);
  if (!tokens?.accessToken) return false;
  setAccountTokens(toProvider, toId, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes || [],
    providerAccountId: externalId || tokens.providerAccountId || null,
    pages: tokens.pages || null,
  });
  return true;
}

/**
 * @param {{
 *   sessionId?: string,
 *   operatorId?: string | null,
 *   workspaceId?: string | null,
 *   selectedIds?: string[],
 *   choices?: Record<string, string>,
 * }} [input]
 */
export async function confirmAccountConnection({
  sessionId,
  operatorId,
  workspaceId,
  selectedIds = [],
  choices = {},
} = {}) {
  if (!isConnectionSessionId(sessionId)) return { ok: false, failure: "expired", needsChoice: [] };
  const session = getConnectionSession(sessionId);
  if (!session) return { ok: false, failure: "expired", needsChoice: [] };
  if (session.operatorId && operatorId && session.operatorId !== operatorId) {
    return { ok: false, failure: "workspace", needsChoice: [] };
  }
  if (session.workspaceId && workspaceId && session.workspaceId !== workspaceId) {
    return { ok: false, failure: "workspace", needsChoice: [] };
  }
  await initDb();
  const existing = publicAccounts(await list(COLLECTIONS.accounts), session.workspaceId);
  const plan = planConnectionConfirmation({
    accounts: existing,
    workspaceId: session.workspaceId,
    destinations: session.destinations || [],
    selectedIds,
    choices,
  });
  if (!plan.ok) return { ...plan, session: publicConnectionSession(session) };

  const created = [];
  for (const partial of plan.created) {
    const account = stripAccount({
      ...emptyAccount({
        ...partial,
        managedProfileId: session.workspaceId,
        active: true,
      }),
      providerAccountId: partial.providerAccountId,
      externalDestinationId: partial.externalDestinationId || partial.providerAccountId,
      pageId: partial.pageId || "",
      pageName: partial.pageName || "",
      lastVerifiedAt: nowIso(),
      connectionState: "CONNECTED",
      connectionMethod: "OAUTH",
    });
    await upsert(COLLECTIONS.accounts, account);
    relocateTokens(session.provider, session.id, normalizeTokenProvider(partial.platform), account.id, partial.providerAccountId);
    created.push(account);
  }
  const linked = [];
  for (const item of plan.linked) {
    const current = await get(COLLECTIONS.accounts, item.accountId);
    if (!current) continue;
    const next = stripAccount({
      ...current,
      ...item.account,
      id: current.id,
      createdAt: current.createdAt,
      lastVerifiedAt: nowIso(),
      updatedAt: nowIso(),
      pendingDestinations: [],
    });
    await upsert(COLLECTIONS.accounts, next);
    relocateTokens(session.provider, session.id, normalizeTokenProvider(next.platform), next.id, next.providerAccountId);
    linked.push(next);
  }
  clearAccountTokens(session.provider, session.id);
  clearConnectionSession(session.id);
  return { ok: true, created, linked, blocked: plan.blocked };
}

function normalizeTokenProvider(platform) {
  return String(platform || "").toLowerCase();
}

export async function cancelAccountConnection({ sessionId, operatorId, workspaceId } = {}) {
  const session = getConnectionSession(sessionId);
  if (!session) return { ok: true };
  if (session.operatorId && operatorId && session.operatorId !== operatorId) {
    return { ok: false, failure: "workspace" };
  }
  if (session.workspaceId && workspaceId && session.workspaceId !== workspaceId) {
    return { ok: false, failure: "workspace" };
  }
  clearAccountTokens(session.provider, session.id);
  clearConnectionSession(session.id);
  return { ok: true };
}

export function readPublicConnectionSession(sessionId, { operatorId, workspaceId } = {}) {
  const session = getConnectionSession(sessionId);
  if (!session) return { ok: false, failure: "expired" };
  if (session.operatorId && operatorId && session.operatorId !== operatorId) {
    return { ok: false, failure: "workspace" };
  }
  if (session.workspaceId && workspaceId && session.workspaceId !== workspaceId) {
    return { ok: false, failure: "workspace" };
  }
  return { ok: true, session: publicConnectionSession(session) };
}
