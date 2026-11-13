import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { readSecrets, writeSecrets } from "../secrets.js";
import { PROTOCOL_VERSION } from "./capabilities.js";

export const SESSION_PREFIX = "eas_";
export const PAIRING_PREFIX = "rlp_";
export const SESSION_TTL_MS = 15 * 60 * 1000;
export const PAIRING_TTL_MS = 10 * 60 * 1000;
export const MAX_AUDIT = 500;
export const MAX_PROPOSALS = 200;

export const AUDIT = Object.freeze({
  PAIRING_CREATED: "PAIRING_CREATED",
  PAIRING_CONSUMED: "PAIRING_CONSUMED",
  PAIRING_CANCELLED: "PAIRING_CANCELLED",
  PAIRING_EXPIRED: "PAIRING_EXPIRED",
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_REVOKED: "SESSION_REVOKED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  CONTEXT_READ: "CONTEXT_READ",
  PROPOSAL_SUBMITTED: "PROPOSAL_SUBMITTED",
  PROPOSAL_ACCEPTED: "PROPOSAL_ACCEPTED",
  PROPOSAL_DISMISSED: "PROPOSAL_DISMISSED",
  REQUEST_DENIED: "REQUEST_DENIED",
});

function emptyBridge() {
  return {
    pairings: {},
    sessions: {},
    proposals: [],
    audit: [],
  };
}

function bucket() {
  const secrets = readSecrets();
  secrets.externalAgent = {
    ...emptyBridge(),
    ...(secrets.externalAgent || {}),
    pairings: { ...(secrets.externalAgent?.pairings || {}) },
    sessions: { ...(secrets.externalAgent?.sessions || {}) },
    proposals: [...(secrets.externalAgent?.proposals || [])],
    audit: [...(secrets.externalAgent?.audit || [])],
  };
  return secrets;
}

function prune(bridge, now = Date.now()) {
  let dirty = false;
  for (const [id, row] of Object.entries(bridge.pairings || {})) {
    const expires = Date.parse(row?.expiresAt || "");
    if (row?.status === "active" && Number.isFinite(expires) && expires <= now) {
      row.status = "expired";
      row.expiredAt = new Date(now).toISOString();
      bridge.audit.push({
        id: `eaa_${randomBytes(8).toString("hex")}`,
        at: new Date(now).toISOString(),
        sessionId: null,
        agentId: null,
        action: AUDIT.PAIRING_EXPIRED,
        detail: { pairingId: id },
      });
      dirty = true;
    }
    if (["consumed", "cancelled", "expired"].includes(row?.status)
      && Date.parse(row?.expiresAt || "") <= now - PAIRING_TTL_MS) {
      delete bridge.pairings[id];
      dirty = true;
    }
  }
  for (const [id, row] of Object.entries(bridge.sessions || {})) {
    const expires = Date.parse(row?.expiresAt || "");
    if (row?.status === "active" && Number.isFinite(expires) && expires <= now) {
      row.status = "expired";
      row.endedAt = new Date(now).toISOString();
      bridge.audit.push({
        id: `eaa_${randomBytes(8).toString("hex")}`,
        at: new Date(now).toISOString(),
        sessionId: id,
        agentId: row.agentId || null,
        action: AUDIT.SESSION_EXPIRED,
        detail: {},
      });
      delete bridge.sessions[id];
      dirty = true;
    } else if (row?.status !== "active") {
      delete bridge.sessions[id];
      dirty = true;
    }
  }
  if (bridge.audit.length > MAX_AUDIT) {
    bridge.audit = bridge.audit.slice(-MAX_AUDIT);
    dirty = true;
  }
  if (bridge.proposals.length > MAX_PROPOSALS) {
    bridge.proposals = bridge.proposals.slice(-MAX_PROPOSALS);
    dirty = true;
  }
  return dirty;
}

function pruneAndMaybePersist(secrets, now = Date.now()) {
  if (prune(secrets.externalAgent, now)) writeSecrets(secrets);
}

export function hashToken(token) {
  return createHash("sha256").update(String(token || "")).digest("hex");
}

export function tokensMatch(storedHash, presentedToken) {
  if (!storedHash || !presentedToken) return false;
  const left = Buffer.from(String(storedHash), "utf8");
  const right = Buffer.from(hashToken(presentedToken), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function generatePairingCredential() {
  return `${PAIRING_PREFIX}${randomBytes(32).toString("base64url")}`;
}

export function publicPairing(row) {
  if (!row) return null;
  const used = row.status === "consumed" || Boolean(row.consumedAt);
  return {
    id: row.id,
    status: row.status,
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    operatorId: row.operatorId,
    agentKey: row.agentKey || null,
    agentLabel: row.agentLabel || null,
    agentRole: row.agentRole || null,
    connectionMode: row.connectionMode || null,
    used,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt || null,
    cancelledAt: row.cancelledAt || null,
  };
}

export function createPairingRecord({
  operatorId,
  workspaceId,
  workspaceName = "",
  agentKey = null,
  agentLabel = null,
  agentRole = null,
  connectionMode = null,
} = {}) {
  const secrets = bucket();
  const now = Date.now();
  prune(secrets.externalAgent, now);
  // Persist happens with the new pairing write below.
  const superseded = Object.values(secrets.externalAgent.pairings)
    .filter((row) => row.status === "active" && row.workspaceId === workspaceId);
  for (const row of superseded) {
    row.status = "cancelled";
    row.cancelledAt = new Date(now).toISOString();
    row.credentialHash = hashToken(`cancelled:${row.id}:${randomBytes(8).toString("hex")}`);
  }
  const pairingCredential = generatePairingCredential();
  const id = `eapair_${randomBytes(10).toString("hex")}`;
  const row = {
    id,
    credentialHash: hashToken(pairingCredential),
    status: "active",
    operatorId: operatorId || null,
    workspaceId: workspaceId || null,
    workspaceName: String(workspaceName || "").slice(0, 160),
    agentKey: agentKey || null,
    agentLabel: agentLabel ? String(agentLabel).slice(0, 80) : null,
    agentRole: agentRole ? String(agentRole).slice(0, 64) : null,
    connectionMode: connectionMode ? String(connectionMode).slice(0, 40) : null,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + PAIRING_TTL_MS).toISOString(),
  };
  secrets.externalAgent.pairings[id] = row;
  for (const old of superseded) {
    secrets.externalAgent.audit.push({
      id: `eaa_${randomBytes(8).toString("hex")}`,
      at: new Date(now).toISOString(),
      sessionId: null,
      agentId: null,
      action: AUDIT.PAIRING_CANCELLED,
      detail: sanitizeDetail({ pairingId: old.id, reason: "superseded" }),
    });
  }
  secrets.externalAgent.audit.push({
    id: `eaa_${randomBytes(8).toString("hex")}`,
    at: new Date(now).toISOString(),
    sessionId: null,
    agentId: null,
    action: AUDIT.PAIRING_CREATED,
    detail: sanitizeDetail({
      pairingId: id,
      workspaceId,
      agentKey,
      agentRole,
      connectionMode,
    }),
  });
  writeSecrets(secrets);
  return { pairing: publicPairing(row), pairingCredential };
}

/** Invalidate every active pairing (security rotation). Does not log plaintext. */
export function cancelAllActivePairings({ reason = "security_rotation" } = {}) {
  const secrets = bucket();
  const now = Date.now();
  prune(secrets.externalAgent, now);
  let count = 0;
  for (const row of Object.values(secrets.externalAgent.pairings || {})) {
    if (row.status !== "active") continue;
    row.status = "cancelled";
    row.cancelledAt = new Date(now).toISOString();
    row.cancelReason = String(reason).slice(0, 80);
    row.credentialHash = hashToken(`invalidated:${row.id}:${randomBytes(8).toString("hex")}`);
    secrets.externalAgent.audit.push({
      id: `eaa_${randomBytes(8).toString("hex")}`,
      at: new Date(now).toISOString(),
      sessionId: null,
      agentId: null,
      action: AUDIT.PAIRING_CANCELLED,
      detail: sanitizeDetail({ pairingId: row.id, reason }),
    });
    count += 1;
  }
  if (count) writeSecrets(secrets);
  return { ok: true, cancelled: count };
}

export function findActivePairingByCredential(credential) {
  if (!String(credential || "").startsWith(PAIRING_PREFIX)) return null;
  const secrets = bucket();
  pruneAndMaybePersist(secrets);
  for (const row of Object.values(secrets.externalAgent.pairings || {})) {
    if (row.status !== "active") continue;
    if (Date.parse(row.expiresAt) <= Date.now()) continue;
    if (tokensMatch(row.credentialHash, credential)) return row;
  }
  return null;
}

export function getActivePairingForWorkspace(workspaceId) {
  const secrets = bucket();
  pruneAndMaybePersist(secrets);
  return Object.values(secrets.externalAgent.pairings || {})
    .find((row) => row.status === "active" && row.workspaceId === workspaceId) || null;
}

export function cancelPairing(pairingId, { workspaceId } = {}) {
  const secrets = bucket();
  const row = secrets.externalAgent.pairings?.[pairingId];
  if (!row) return null;
  if (workspaceId && row.workspaceId !== workspaceId) return null;
  if (row.status !== "active") return publicPairing(row);
  row.status = "cancelled";
  row.cancelledAt = new Date().toISOString();
  row.credentialHash = hashToken(`cancelled:${row.id}:${randomBytes(8).toString("hex")}`);
  writeSecrets(secrets);
  appendAudit({
    sessionId: null,
    agentId: null,
    action: AUDIT.PAIRING_CANCELLED,
    detail: { pairingId },
  });
  return publicPairing(row);
}

export function consumePairing(pairingId) {
  const secrets = bucket();
  const row = secrets.externalAgent.pairings?.[pairingId];
  if (!row || row.status !== "active") return null;
  if (Date.parse(row.expiresAt) <= Date.now()) {
    row.status = "expired";
    row.expiredAt = new Date().toISOString();
    writeSecrets(secrets);
    return null;
  }
  row.status = "consumed";
  row.consumedAt = new Date().toISOString();
  // Destroy hash so the credential can never match again.
  row.credentialHash = hashToken(`consumed:${row.id}:${randomBytes(8).toString("hex")}`);
  writeSecrets(secrets);
  appendAudit({
    sessionId: null,
    agentId: null,
    action: AUDIT.PAIRING_CONSUMED,
    detail: { pairingId },
  });
  return publicPairing(row);
}

export function createSessionRecord({
  agentType,
  displayName = "",
  instanceId,
  protocolVersion = PROTOCOL_VERSION,
  capabilities = [],
  agentRole = "TRUSTED_ANALYST",
  workspaceId = null,
  workspaceName = "",
  operatorId = null,
  pairingId = null,
} = {}) {
  const secrets = bucket();
  const now = Date.now();
  prune(secrets.externalAgent, now);
  const sessionId = `${SESSION_PREFIX}${randomBytes(12).toString("hex")}`;
  const sessionToken = `${SESSION_PREFIX}tok_${randomBytes(24).toString("hex")}`;
  const row = {
    id: sessionId,
    tokenHash: hashToken(sessionToken),
    agentType: String(agentType || "external").slice(0, 64),
    agentId: String(instanceId || agentType || "external").slice(0, 120),
    displayName: String(displayName || "").slice(0, 160),
    instanceId: String(instanceId || "").slice(0, 160),
    protocolVersion: String(protocolVersion || PROTOCOL_VERSION).slice(0, 16),
    capabilities: Array.isArray(capabilities) ? capabilities.map(String).slice(0, 32) : [],
    agentRole: String(agentRole || "TRUSTED_ANALYST").slice(0, 64),
    workspaceId: workspaceId || null,
    workspaceName: String(workspaceName || "").slice(0, 160),
    operatorId: operatorId || null,
    pairingId: pairingId || null,
    status: "active",
    role: "trusted_analyst",
    startedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
    lastSeenAt: new Date(now).toISOString(),
  };
  secrets.externalAgent.sessions[sessionId] = row;
  writeSecrets(secrets);
  appendAudit({
    sessionId,
    agentId: row.agentId,
    action: AUDIT.SESSION_CREATED,
    detail: {
      agentType: row.agentType,
      instanceId: row.instanceId,
      protocolVersion: row.protocolVersion,
      capabilities: row.capabilities,
      workspaceId: row.workspaceId,
    },
  });
  return { session: publicSession(row), sessionToken };
}

export function publicSession(row) {
  if (!row) return null;
  return {
    id: row.id,
    agentType: row.agentType,
    agentId: row.agentId,
    displayName: row.displayName,
    instanceId: row.instanceId,
    protocolVersion: row.protocolVersion,
    capabilities: [...(row.capabilities || [])],
    agentRole: row.agentRole || "TRUSTED_ANALYST",
    workspaceId: row.workspaceId,
    workspaceName: row.workspaceName,
    status: row.status,
    role: row.role,
    startedAt: row.startedAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
  };
}

export function findSessionByToken(token) {
  if (!String(token || "").startsWith(SESSION_PREFIX)) return null;
  const secrets = bucket();
  pruneAndMaybePersist(secrets);
  for (const row of Object.values(secrets.externalAgent.sessions || {})) {
    if (row.status !== "active") continue;
    if (Date.parse(row.expiresAt) <= Date.now()) continue;
    if (tokensMatch(row.tokenHash, token)) return row;
  }
  return null;
}

export function getActiveSessionForWorkspace(workspaceId) {
  const secrets = bucket();
  pruneAndMaybePersist(secrets);
  return Object.values(secrets.externalAgent.sessions || {})
    .find((row) => row.status === "active" && row.workspaceId === workspaceId) || null;
}

export function touchSession(sessionId) {
  const secrets = bucket();
  const row = secrets.externalAgent.sessions?.[sessionId];
  if (!row || row.status !== "active") return null;
  if (Date.parse(row.expiresAt) <= Date.now()) return null;
  row.lastSeenAt = new Date().toISOString();
  writeSecrets(secrets);
  return row;
}

export function endSession(sessionId, { reason = "revoked", workspaceId = null } = {}) {
  const secrets = bucket();
  const row = secrets.externalAgent.sessions?.[sessionId];
  if (!row) return null;
  if (workspaceId && row.workspaceId !== workspaceId) return null;
  row.status = reason === "expired" ? "expired" : "revoked";
  row.endedAt = new Date().toISOString();
  delete secrets.externalAgent.sessions[sessionId];
  writeSecrets(secrets);
  appendAudit({
    sessionId,
    agentId: row.agentId,
    action: reason === "expired" ? AUDIT.SESSION_EXPIRED : AUDIT.SESSION_REVOKED,
    detail: {},
  });
  return publicSession({ ...row, status: row.status });
}

export function appendAudit({ sessionId, agentId, action, detail = {} }) {
  const secrets = bucket();
  prune(secrets.externalAgent);
  // Persist with the audit write below.
  const entry = {
    id: `eaa_${randomBytes(8).toString("hex")}`,
    at: new Date().toISOString(),
    sessionId: sessionId || null,
    agentId: agentId || null,
    action: String(action || "").slice(0, 80),
    detail: sanitizeDetail(detail),
  };
  secrets.externalAgent.audit.push(entry);
  writeSecrets(secrets);
  return entry;
}

export function appendProposal({
  sessionId,
  agentId,
  agentType = "",
  displayName = "",
  workspaceId = null,
  type = "recommendation",
  title,
  summary,
  recommendation,
  evidenceReferences = [],
  category = "general",
}) {
  const secrets = bucket();
  prune(secrets.externalAgent);
  // Persist with the proposal write below.
  const row = {
    id: `eap_${randomBytes(8).toString("hex")}`,
    sessionId,
    agentId,
    agentType,
    displayName,
    workspaceId,
    type: String(type || "recommendation").slice(0, 64),
    title: String(title || "").slice(0, 160),
    summary: String(summary || "").slice(0, 2000),
    recommendation: String(recommendation || "").slice(0, 8000),
    evidenceReferences: Array.isArray(evidenceReferences)
      ? evidenceReferences.map((item) => String(item).slice(0, 200)).slice(0, 20)
      : [],
    category: String(category || "general").slice(0, 64),
    status: "recorded",
    execution: "never_auto_executed",
    createdAt: new Date().toISOString(),
    reviewedAt: null,
  };
  secrets.externalAgent.proposals.push(row);
  writeSecrets(secrets);
  appendAudit({
    sessionId,
    agentId,
    action: AUDIT.PROPOSAL_SUBMITTED,
    detail: { proposalId: row.id, category: row.category, type: row.type },
  });
  return row;
}

export function listProposalsForSession(sessionId) {
  const secrets = bucket();
  return (secrets.externalAgent.proposals || [])
    .filter((row) => row.sessionId === sessionId)
    .map((row) => ({ ...row }));
}

export function listProposalsForWorkspace(workspaceId, { limit = 50 } = {}) {
  const secrets = bucket();
  return (secrets.externalAgent.proposals || [])
    .filter((row) => !workspaceId || row.workspaceId === workspaceId)
    .slice(-limit)
    .reverse()
    .map((row) => ({ ...row }));
}

export function reviewProposal(proposalId, { workspaceId, status, operatorId }) {
  const secrets = bucket();
  const row = (secrets.externalAgent.proposals || []).find((item) => item.id === proposalId);
  if (!row) return null;
  if (workspaceId && row.workspaceId !== workspaceId) return null;
  if (!["accepted", "dismissed"].includes(status)) return null;
  row.status = status;
  row.reviewedAt = new Date().toISOString();
  row.reviewedBy = operatorId || null;
  writeSecrets(secrets);
  appendAudit({
    sessionId: row.sessionId,
    agentId: row.agentId,
    action: status === "accepted" ? AUDIT.PROPOSAL_ACCEPTED : AUDIT.PROPOSAL_DISMISSED,
    detail: { proposalId, note: "Accept records operator agreement only. Nothing was executed." },
  });
  return { ...row };
}

export function bridgeOperatorSnapshot(workspaceId) {
  const secrets = bucket();
  pruneAndMaybePersist(secrets);
  const pairing = Object.values(secrets.externalAgent.pairings || {})
    .find((row) => row.status === "active" && row.workspaceId === workspaceId) || null;
  const session = Object.values(secrets.externalAgent.sessions || {})
    .find((row) => row.status === "active" && row.workspaceId === workspaceId) || null;
  return {
    pairing: publicPairing(pairing),
    session: publicSession(session),
    proposals: listProposalsForWorkspace(workspaceId, { limit: 20 }),
  };
}

function sanitizeDetail(detail) {
  const raw = JSON.stringify(detail || {});
  const cleaned = raw
    .replace(/"(accessToken|refreshToken|clientSecret|authorization|token|apiKey|AUTH_SECRET|pageAccessToken|pairingCredential|sessionToken|credentialHash|tokenHash)"\s*:\s*"[^"]*"/gi, '"$1":"[redacted]"')
    .replace(/rlp_[A-Za-z0-9_-]{16,}/g, "[redacted-pairing]")
    .replace(/eas_tok_[A-Za-z0-9_-]{16,}/g, "[redacted-session]")
    .slice(0, 2000);
  try {
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}
