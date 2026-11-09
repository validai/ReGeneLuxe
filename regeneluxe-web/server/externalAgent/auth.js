import { isLoopbackHostname } from "../auth/origin.js";
import { findSessionByToken, publicSession, touchSession, appendAudit, AUDIT } from "./store.js";
import { PROTOCOL_VERSION } from "./capabilities.js";
import { uiPort } from "../config.js";

export function bridgeEnabled() {
  return String(process.env.EXTERNAL_AGENT_BRIDGE_ENABLED || "").trim() === "1";
}

export function bridgeReadiness() {
  if (!bridgeEnabled()) {
    return {
      ok: false,
      code: "BRIDGE_DISABLED",
      error: "The External Agent Bridge is disabled. Set EXTERNAL_AGENT_BRIDGE_ENABLED=1 to allow operator-initiated pairing on this local instance.",
    };
  }
  return { ok: true, code: "READY" };
}

export function extractSessionToken(request) {
  return String(request.headers.get("x-regeneluxe-agent-session") || "").trim();
}

export function extractPairingCredential(request, body = {}) {
  const header = String(request.headers.get("x-regeneluxe-agent-pairing") || "").trim();
  if (header) return header;
  return String(body.pairingCredential || body.pairingSecret || "").trim();
}

/**
 * Fail closed unless the request is clearly local to this ReGeneLuxe instance.
 * Host / forwarded-for / loopback Origin are checked. Origin alone is never enough.
 */
export function assertLocalBridgeRequest(request) {
  const fetchSite = String(request.headers.get("sec-fetch-site") || "").toLowerCase();
  if (fetchSite === "cross-site") {
    return { ok: false, status: 403, code: "REQUEST_DENIED", error: "Cross-site External Agent Bridge calls are not allowed." };
  }

  const expectedPort = String(uiPort());
  const hostHeader = String(request.headers.get("x-forwarded-host") || request.headers.get("host") || "");
  const hostName = hostHeader.split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  const hostPort = hostHeader.includes(":")
    ? hostHeader.replace(/^\[.*?\]:/, "").split(":").pop()
    : "";

  if (!hostHeader) {
    return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge requires an explicit local Host." };
  }
  if (!isLoopbackHostname(hostName)) {
    return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge is local-only." };
  }
  if (hostPort && hostPort !== expectedPort) {
    return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge accepts only the ReGeneLuxe port." };
  }

  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const parsed = new URL(origin);
      const originPort = String(parsed.port || (parsed.protocol === "https:" ? "443" : "80"));
      if (!isLoopbackHostname(parsed.hostname)) {
        return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge accepts only the local ReGeneLuxe origin." };
      }
      if (originPort !== expectedPort && originPort !== "80") {
        return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge accepts only the ReGeneLuxe origin port." };
      }
    } catch {
      return { ok: false, status: 403, code: "REQUEST_DENIED", error: "Invalid Origin for External Agent Bridge." };
    }
  }

  const forwarded = String(request.headers.get("x-forwarded-for") || "").trim();
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (!isLoopbackHostname(first) && first !== "::1") {
      return { ok: false, status: 403, code: "REQUEST_DENIED", error: "External Agent Bridge is local-only." };
    }
  }

  return { ok: true };
}

export function requireBridgeEnabled(request) {
  const readiness = bridgeReadiness();
  if (!readiness.ok) return { ok: false, status: 503, ...readiness };
  const local = assertLocalBridgeRequest(request);
  if (!local.ok) {
    appendAudit({
      sessionId: null,
      agentId: null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: local.error },
    });
    return local;
  }
  return { ok: true };
}

export function requireAgentSession(request, { capability = null } = {}) {
  const gated = requireBridgeEnabled(request);
  if (!gated.ok) return gated;
  const token = extractSessionToken(request);
  const row = findSessionByToken(token);
  if (!row) {
    appendAudit({
      sessionId: null,
      agentId: null,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: "SESSION_REQUIRED" },
    });
    return { ok: false, status: 401, code: "SESSION_REQUIRED", error: "A valid External Agent session is required." };
  }
  if (capability) {
    const granted = (row.capabilities || []).map((item) => String(item).toUpperCase());
    if (!granted.includes(String(capability).toUpperCase())) {
      appendAudit({
        sessionId: row.id,
        agentId: row.agentId,
        action: AUDIT.REQUEST_DENIED,
        detail: { reason: "CAPABILITY_MISSING", capability },
      });
      return {
        ok: false,
        status: 403,
        code: "CAPABILITY_MISSING",
        error: `This session was not granted ${capability}.`,
      };
    }
  }
  if (String(row.protocolVersion || "") !== PROTOCOL_VERSION) {
    appendAudit({
      sessionId: row.id,
      agentId: row.agentId,
      action: AUDIT.REQUEST_DENIED,
      detail: { reason: "PROTOCOL_MISMATCH", protocolVersion: row.protocolVersion || null },
    });
    return {
      ok: false,
      status: 403,
      code: "PROTOCOL_MISMATCH",
      error: "Session protocol version is not supported.",
    };
  }
  touchSession(row.id);
  return { ok: true, session: publicSession(row), sessionRow: row };
}
