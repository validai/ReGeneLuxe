import {
  ALLOWED_CAPABILITIES,
  PROTOCOL_VERSION,
  capabilitiesPayload,
  isDeniedAction,
  validateRequestedCapabilities,
} from "./capabilities.js";
import { northStarPayload } from "./northStar.js";
import { buildOperationsSummary, buildSanitizedContext } from "./context.js";
import {
  AUDIT,
  appendAudit,
  appendProposal,
  bridgeOperatorSnapshot,
  cancelAllActivePairings,
  cancelPairing,
  consumePairing,
  createPairingRecord,
  createSessionRecord,
  endSession,
  findActivePairingByCredential,
  getActivePairingForWorkspace,
  getActiveSessionForWorkspace,
  listProposalsForSession,
  listProposalsForWorkspace,
  publicPairing,
  publicSession,
  reviewProposal,
  SESSION_TTL_MS,
} from "./store.js";
import {
  bridgeEnabled,
  bridgeReadiness,
  extractPairingCredential,
  requireAgentSession,
  requireBridgeEnabled,
} from "./auth.js";
import { normalizeAgentRole } from "./roles.js";
import {
  agentCatalogPublic,
  getAgentPreset,
  matchHandshakeToPreset,
  rosterFromSession,
} from "./agentCatalog.js";
import { resolveTransport, transportPublicTruth, CONNECTION_MODES } from "./transport.js";
import {
  createMarketingDraft,
  getMarketingDraft,
  listMarketingDrafts,
  submitMarketingDraft,
  updateOwnMarketingDraft,
} from "../marketingDrafts/service.js";

function deriveUiState({ readiness, snapshot }) {
  if (!readiness.ok) return "DISABLED";
  if (snapshot.session) return "CONNECTED";
  if (snapshot.pairing?.status === "active") return "WAITING_FOR_AGENT";
  return "READY";
}

export function getBridgeStatus(workspaceId = null) {
  const readiness = bridgeReadiness();
  const snapshot = workspaceId ? bridgeOperatorSnapshot(workspaceId) : { pairing: null, session: null, proposals: [] };
  const state = deriveUiState({ readiness, snapshot });
  const transport = transportPublicTruth();
  return {
    ok: true,
    enabled: bridgeEnabled(),
    ready: readiness.ok,
    code: readiness.code || "READY",
    error: readiness.error || null,
    state,
    /** @deprecated aliases kept for older clients during transition */
    legacyState: state === "CONNECTED"
      ? "PAIRED"
      : state === "WAITING_FOR_AGENT"
        ? "PAIRING_ACTIVE"
        : state === "READY"
          ? "READY_FOR_PAIRING"
          : state,
    role: "trusted_analyst",
    protocolVersion: PROTOCOL_VERSION,
    sessionTtlMinutes: Math.round(SESSION_TTL_MS / 60000),
    pairingTtlMinutes: 10,
    allowedCapabilities: [...ALLOWED_CAPABILITIES],
    note: "sessionTtlMinutes is the External Agent session TTL (15). It is not a social-post approval window.",
    transport,
    connectionModes: Object.values(CONNECTION_MODES),
    agents: agentCatalogPublic(),
    roster: rosterFromSession(snapshot.session),
    pairing: snapshot.pairing,
    session: snapshot.session,
    proposals: snapshot.proposals,
    version: 2,
  };
}

/**
 * @param {{
 *   operatorId?: string | null,
 *   workspaceId?: string | null,
 *   workspaceName?: string,
 *   agentKey?: string | null,
 *   connectionMode?: string | null,
 * }} [opts]
 */
export function startOperatorPairing({
  operatorId,
  workspaceId,
  workspaceName = "",
  agentKey = null,
  connectionMode = null,
} = {}) {
  const readiness = bridgeReadiness();
  if (!readiness.ok) return { ok: false, status: 503, ...readiness };
  if (!operatorId || !workspaceId) {
    return { ok: false, status: 400, code: "WORKSPACE_REQUIRED", error: "A signed-in workspace is required to start pairing." };
  }

  const transport = resolveTransport({ connectionMode });
  if (!transport.ok) {
    return {
      ok: false,
      status: transport.status,
      code: transport.code,
      error: transport.error,
      operatorMessage: transport.operatorMessage,
      transport,
      state: transport.code === "REMOTE_TRANSPORT_REQUIRED" ? "REMOTE_TRANSPORT_REQUIRED" : "ERROR",
    };
  }

  const preset = getAgentPreset(agentKey);
  if (!preset) {
    return {
      ok: false,
      status: 400,
      code: "AGENT_REQUIRED",
      error: "Choose which agent you are connecting before creating a pairing credential.",
      state: "ERROR",
    };
  }

  const created = createPairingRecord({
    operatorId,
    workspaceId,
    workspaceName,
    agentKey: preset.key,
    agentLabel: preset.label,
    agentRole: preset.role,
    connectionMode: transport.connectionMode,
  });
  return {
    ok: true,
    status: 200,
    state: "WAITING_FOR_AGENT",
    pairing: created.pairing,
    pairingCredential: created.pairingCredential,
    agent: {
      key: preset.key,
      label: preset.label,
      role: preset.role,
      roleLabel: preset.roleLabel,
    },
    connectionMode: transport.connectionMode,
    transport,
    instructions: {
      title: "Temporary certification pairing",
      steps: [
        "Open the intended local test client (or local agent process) on this machine.",
        "Put the credential into the secure Secrets field — never into normal chat.",
        "Paste it as REGENELUXE_PAIRING_CREDENTIAL (or the client equivalent).",
        "Return here. ReGeneLuxe shows WAITING FOR AGENT until handshake succeeds.",
        "When handshake succeeds, this credential disappears and the agent shows as CONNECTED.",
      ],
      secretName: "REGENELUXE_PAIRING_CREDENTIAL",
      doNotPasteIntoChat: true,
    },
    warning: "This one-time pairing credential is shown once, expires in about 10 minutes, and is never stored in plaintext. It works only for a local client that can reach localhost:5174.",
  };
}

export function cancelOperatorPairing({ workspaceId }) {
  const readiness = bridgeReadiness();
  if (!readiness.ok) return { ok: false, status: 503, ...readiness };
  const active = getActivePairingForWorkspace(workspaceId);
  if (!active) return { ok: false, status: 404, error: "No active pairing to cancel.", state: "CANCELLED" };
  return {
    ok: true,
    status: 200,
    state: "CANCELLED",
    pairing: cancelPairing(active.id, { workspaceId }),
  };
}

export function invalidateExposedPairings({ reason = "security_exposed_credential_rotation" } = {}) {
  return cancelAllActivePairings({ reason });
}

export function revokeOperatorSession({ workspaceId }) {
  const active = getActiveSessionForWorkspace(workspaceId);
  if (!active) return { ok: false, status: 404, error: "No active external-agent session." };
  return { ok: true, status: 200, session: endSession(active.id, { workspaceId, reason: "revoked" }) };
}

export function beginHandshake(request, body = {}) {
  const gated = requireBridgeEnabled(request);
  if (!gated.ok) return gated;

  const pairingCredential = extractPairingCredential(request, body);
  const pairing = findActivePairingByCredential(pairingCredential);
  if (!pairing) {
    appendAudit({
      sessionId: null,
      agentId: body?.instanceId || body?.agentId || null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: "INVALID_OR_EXPIRED_PAIRING" },
    });
    return {
      ok: false,
      status: 401,
      code: "INVALID_OR_EXPIRED_PAIRING",
      error: "Pairing credential was rejected, expired, cancelled, or already consumed.",
    };
  }

  if (String(body.protocolVersion || "") !== PROTOCOL_VERSION) {
    appendAudit({
      sessionId: null,
      agentId: body?.instanceId || null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: "PROTOCOL_MISMATCH", protocolVersion: body.protocolVersion || null },
    });
    return {
      ok: false,
      status: 400,
      code: "PROTOCOL_MISMATCH",
      error: `protocolVersion must be ${PROTOCOL_VERSION}.`,
    };
  }

  const agentType = String(body.agentType || "").trim();
  const displayName = String(body.displayName || "").trim();
  const instanceId = String(body.instanceId || "").trim();
  if (!agentType || !displayName || !instanceId) {
    return {
      ok: false,
      status: 400,
      code: "AGENT_IDENTITY_REQUIRED",
      error: "agentType, displayName, and instanceId are required.",
    };
  }

  const preset = getAgentPreset(pairing.agentKey);
  if (preset) {
    const matched = matchHandshakeToPreset(preset, { agentType, displayName });
    if (!matched.ok) {
      appendAudit({
        sessionId: null,
        agentId: body?.instanceId || null,
        action: AUDIT.REQUEST_DENIED,
        detail: { reason: matched.code, expectedAgent: preset.key },
      });
      return { ok: false, status: 403, ...matched };
    }
  }

  const agentRole = normalizeAgentRole(
    body.agentRole || body.role || pairing.agentRole,
    { agentType, displayName },
  );
  if (pairing.agentRole && agentRole !== pairing.agentRole && preset?.key !== "other") {
    appendAudit({
      sessionId: null,
      agentId: body?.instanceId || null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: "WRONG_ROLE", expected: pairing.agentRole, got: agentRole },
    });
    return {
      ok: false,
      status: 403,
      code: "WRONG_ROLE",
      error: `This pairing requires role ${pairing.agentRole}.`,
    };
  }

  const caps = validateRequestedCapabilities(body.requestedCapabilities, { agentRole });
  if (!caps.ok) {
    appendAudit({
      sessionId: null,
      agentId: body?.instanceId || null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: caps.code, unknown: caps.unknown || [], roleDenied: caps.roleDenied || [] },
    });
    return { ok: false, status: 403, ...caps };
  }

  if (isDeniedAction(body?.requestedAction)) {
    appendAudit({
      sessionId: null,
      agentId: body?.instanceId || null,
      action: AUDIT.REQUEST_DENIED,
      detail: { requestedAction: body?.requestedAction || "" },
    });
    return {
      ok: false,
      status: 403,
      code: "ACTION_DENIED",
      error: "That action is outside the External Agent Bridge role.",
    };
  }

  const consumed = consumePairing(pairing.id);
  if (!consumed) {
    return {
      ok: false,
      status: 401,
      code: "INVALID_OR_EXPIRED_PAIRING",
      error: "Pairing credential could not be consumed.",
    };
  }

  // One active session per workspace.
  const existing = getActiveSessionForWorkspace(pairing.workspaceId);
  if (existing) endSession(existing.id, { workspaceId: pairing.workspaceId, reason: "revoked" });

  const created = createSessionRecord({
    agentType,
    displayName,
    instanceId,
    protocolVersion: PROTOCOL_VERSION,
    capabilities: caps.granted,
    agentRole,
    workspaceId: pairing.workspaceId,
    workspaceName: pairing.workspaceName,
    operatorId: pairing.operatorId,
    pairingId: pairing.id,
  });

  return {
    ok: true,
    status: 200,
    session: created.session,
    sessionToken: created.sessionToken,
    northStar: northStarPayload(),
    capabilities: capabilitiesPayload(caps.granted, { agentRole }),
    warning: "Session tokens expire in 15 minutes (agent session TTL only). Proposals and drafts are never auto-published. Pair again after expiry.",
  };
}

export async function readNorthStar(request) {
  const authz = requireAgentSession(request, { capability: "READ_PRODUCT_CONTEXT" });
  if (!authz.ok) return authz;
  appendAudit({
    sessionId: authz.session.id,
    agentId: authz.session.agentId,
    action: AUDIT.CONTEXT_READ,
    detail: { surface: "north_star" },
  });
  return { ok: true, status: 200, ...northStarPayload() };
}

export async function readCapabilities(request) {
  const authz = requireAgentSession(request);
  if (!authz.ok) return authz;
  return {
    ok: true,
    status: 200,
    ...capabilitiesPayload(authz.session.capabilities, { agentRole: authz.session.agentRole }),
  };
}

export async function readContext(request) {
  const authz = requireAgentSession(request);
  if (!authz.ok) return authz;
  if (!authz.session.workspaceId) {
    return { ok: false, status: 403, code: "WORKSPACE_REQUIRED", error: "Session is not workspace-bound." };
  }
  const context = await buildSanitizedContext({
    workspaceId: authz.session.workspaceId,
    capabilities: authz.session.capabilities,
  });
  appendAudit({
    sessionId: authz.session.id,
    agentId: authz.session.agentId,
    action: AUDIT.CONTEXT_READ,
    detail: { surface: "context", workspaceId: authz.session.workspaceId },
  });
  return { ok: true, status: 200, context };
}

export async function readOperations(request) {
  const authz = requireAgentSession(request, { capability: "READ_OPERATIONAL_HEALTH" });
  if (!authz.ok) return authz;
  const operations = await buildOperationsSummary({ workspaceId: authz.session.workspaceId });
  appendAudit({
    sessionId: authz.session.id,
    agentId: authz.session.agentId,
    action: AUDIT.CONTEXT_READ,
    detail: { surface: "operations" },
  });
  return { ok: true, status: 200, operations };
}

export function submitProposal(request, body = {}) {
  const authz = requireAgentSession(request, { capability: "SUBMIT_PROPOSAL" });
  if (!authz.ok) return authz;

  if (isDeniedAction(body?.action) || isDeniedAction(body?.category) || isDeniedAction(body?.type)) {
    appendAudit({
      sessionId: authz.session.id,
      agentId: authz.session.agentId,
      action: AUDIT.REQUEST_DENIED,
      detail: { action: body?.action || "", category: body?.category || "", type: body?.type || "" },
    });
    return {
      ok: false,
      status: 403,
      code: "ACTION_DENIED",
      error: "Proposals may recommend work. They may not request denied control actions as executable commands.",
    };
  }

  const title = String(body.title || "").trim();
  const summary = String(body.summary || "").trim();
  const recommendation = String(body.recommendation || body.recommendedAction || body.body || "").trim();
  if (!title || !recommendation) {
    return {
      ok: false,
      status: 400,
      code: "INVALID_PROPOSAL",
      error: "A proposal needs a title and a recommended action.",
    };
  }

  const proposal = appendProposal({
    sessionId: authz.session.id,
    agentId: authz.session.agentId,
    agentType: authz.session.agentType,
    displayName: authz.session.displayName,
    workspaceId: authz.session.workspaceId,
    type: body.type || "recommendation",
    title,
    summary,
    recommendation,
    evidenceReferences: body.evidenceReferences || body.evidence || [],
    category: body.category || "general",
  });
  return {
    ok: true,
    status: 200,
    proposal,
    execution: "never_auto_executed",
  };
}

export function listAgentProposals(request) {
  const authz = requireAgentSession(request);
  if (!authz.ok) return authz;
  return { ok: true, status: 200, proposals: listProposalsForSession(authz.session.id) };
}

export function listOperatorProposals({ workspaceId }) {
  return { ok: true, status: 200, proposals: listProposalsForWorkspace(workspaceId) };
}

export function reviewOperatorProposal({ workspaceId, proposalId, status, operatorId }) {
  if (!["accepted", "dismissed"].includes(status)) {
    return { ok: false, status: 400, error: "Status must be accepted or dismissed." };
  }
  const proposal = reviewProposal(proposalId, { workspaceId, status, operatorId });
  if (!proposal) return { ok: false, status: 404, error: "Proposal not found." };
  return {
    ok: true,
    status: 200,
    proposal,
    execution: "never_auto_executed",
    note: status === "accepted"
      ? "Accepted means the operator records agreement with the recommendation. Nothing was executed."
      : "Proposal dismissed.",
  };
}

export function closeSession(request) {
  const authz = requireAgentSession(request);
  if (!authz.ok) return authz;
  return { ok: true, status: 200, session: endSession(authz.session.id, { reason: "revoked" }) };
}

export function denyControlAttempt(request, action) {
  const authz = requireAgentSession(request);
  appendAudit({
    sessionId: authz.ok ? authz.session.id : null,
    agentId: authz.ok ? authz.session.agentId : null,
    action: AUDIT.REQUEST_DENIED,
    detail: { attempted: action },
  });
  return {
    ok: false,
    status: 403,
    code: "ACTION_DENIED",
    error: `External agents cannot ${action}. The bridge is analyst/draft-import only — never publish authority.`,
  };
}

export async function agentCreateDraft(request, body = {}) {
  const authz = requireAgentSession(request, { capability: "CREATE_CONTENT_DRAFT" });
  if (!authz.ok) return authz;
  if (isDeniedAction(body?.action) || isDeniedAction(body?.requestedAction)) {
    return denyControlAttempt(request, body?.action || body?.requestedAction || "PUBLISH");
  }
  return createMarketingDraft(body, authz.session);
}

export async function agentUpdateDraft(request, draftId, body = {}) {
  const authz = requireAgentSession(request, { capability: "UPDATE_OWN_CONTENT_DRAFT" });
  if (!authz.ok) return authz;
  return updateOwnMarketingDraft(draftId, body, authz.session);
}

export async function agentSubmitDraft(request, draftId) {
  const authz = requireAgentSession(request, { capability: "SUBMIT_CONTENT_FOR_APPROVAL" });
  if (!authz.ok) return authz;
  return submitMarketingDraft(draftId, authz.session);
}

export async function agentReadDraft(request, draftId) {
  const authz = requireAgentSession(request, { capability: "READ_APPROVAL_STATUS" });
  if (!authz.ok) return authz;
  const draft = await getMarketingDraft(draftId, { workspaceId: authz.session.workspaceId });
  if (!draft) return { ok: false, status: 404, error: "Draft not found." };
  return {
    ok: true,
    status: 200,
    draft: {
      id: draft.id,
      status: draft.status,
      approvalStatus: draft.approvalStatus,
      scheduledFor: draft.scheduledFor,
      requestedScheduledFor: draft.requestedScheduledFor,
      approvalDeadline: draft.approvalDeadline,
      releaseGateState: draft.releaseGateState,
      providerReadiness: draft.providerReadiness,
      creativeApprovalState: draft.creativeApprovalState,
      scheduledPublishEligibility: draft.scheduledPublishEligibility,
      blockingIssues: draft.blockingIssues,
      updatedAt: draft.updatedAt,
    },
  };
}

export async function agentReadSchedule(request, draftId) {
  const authz = requireAgentSession(request, { capability: "READ_SCHEDULE_ASSIGNMENT" });
  if (!authz.ok) return authz;
  const draft = await getMarketingDraft(draftId, { workspaceId: authz.session.workspaceId });
  if (!draft) return { ok: false, status: 404, error: "Draft not found." };
  return {
    ok: true,
    status: 200,
    schedule: {
      draftId: draft.id,
      requestedScheduledFor: draft.requestedScheduledFor,
      scheduledFor: draft.scheduledFor,
      timezone: draft.timezone,
      approvalDeadline: draft.approvalDeadline,
      scheduleAssignedAt: draft.scheduleAssignedAt,
      authoritative: Boolean(draft.scheduledFor),
      note: "scheduledFor is ReGeneLuxe/operator-controlled. requestedScheduledFor is agent input only.",
    },
  };
}

export async function agentListOwnDrafts(request) {
  const authz = requireAgentSession(request, { capability: "READ_APPROVAL_STATUS" });
  if (!authz.ok) return authz;
  const drafts = await listMarketingDrafts({ workspaceId: authz.session.workspaceId });
  const own = drafts.filter((draft) => draft.createdByInstanceId === authz.session.instanceId);
  return { ok: true, status: 200, drafts: own };
}

export { publicPairing, publicSession };
