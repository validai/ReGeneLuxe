/**
 * Explicit allow / deny surface for the External Agent Bridge.
 * Unknown capabilities are denied. No wildcards.
 */

import { DRAFT_CAPABILITIES, roleAllowsCapability } from "./roles.js";

export const BRIDGE_ROLE = "trusted_analyst";
export const PROTOCOL_VERSION = "1";

export const V1_CAPABILITIES = Object.freeze([
  "READ_PRODUCT_CONTEXT",
  "READ_WORKSPACE_SUMMARY",
  "READ_ACCOUNT_METADATA",
  "READ_CAMPAIGN_SUMMARY",
  "READ_CONTENT_METADATA",
  "READ_ANALYTICS_SUMMARY",
  "READ_INBOX_SUMMARY",
  "READ_OPERATIONAL_HEALTH",
  "SUBMIT_PROPOSAL",
]);

export const ALLOWED_CAPABILITIES = Object.freeze([
  ...V1_CAPABILITIES,
  ...DRAFT_CAPABILITIES,
]);

export const DENIED_ACTIONS = Object.freeze([
  "PUBLISH",
  "PUBLISH_APPROVED_CONTENT",
  "SCHEDULE",
  "SCHEDULE_DIRECTLY",
  "REPLY",
  "SEND_MESSAGE",
  "CONNECT_ACCOUNT",
  "DISCONNECT_ACCOUNT",
  "CHANGE_ACCOUNT",
  "CHANGE_OAUTH_SCOPE",
  "READ_PROVIDER_TOKENS",
  "READ_SECRETS",
  "WRITE_CONTENT",
  "WRITE_CAMPAIGN",
  "WRITE_ACCOUNT",
  "WRITE_QUEUE",
  "WRITE_ANALYTICS",
  "WRITE_INBOX",
  "WRITE_PROVIDER",
  "APPROVE_CONTENT",
  "EXECUTE_PROPOSAL",
  "BYPASS_APPROVAL",
  "ACCESS_FILESYSTEM",
  "RUN_SHELL",
  "CONTROL_PROCESS",
  "READ_ENV",
  "WRITE_ENV",
]);

function normalizeCapability(value) {
  return String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

export function normalizeCapabilityList(values) {
  const list = Array.isArray(values) ? values : [];
  return [...new Set(list.map(normalizeCapability).filter(Boolean))];
}

export function validateRequestedCapabilities(requested, { agentRole = null } = {}) {
  const normalized = normalizeCapabilityList(requested);
  if (!normalized.length) {
    return { ok: false, code: "CAPABILITY_REQUIRED", error: "Request at least one allowed capability.", granted: [] };
  }
  const unknown = normalized.filter((item) => !ALLOWED_CAPABILITIES.includes(item));
  if (unknown.length) {
    return {
      ok: false,
      code: "UNKNOWN_CAPABILITY",
      error: `Unknown capability denied: ${unknown.join(", ")}`,
      granted: [],
      unknown,
    };
  }
  if (agentRole) {
    const roleDenied = normalized.filter((item) => !roleAllowsCapability(agentRole, item));
    if (roleDenied.length) {
      return {
        ok: false,
        code: "ROLE_CAPABILITY_DENIED",
        error: `Role ${agentRole} cannot request: ${roleDenied.join(", ")}`,
        granted: [],
        roleDenied,
      };
    }
  }
  return { ok: true, granted: normalized };
}

export function sessionHasCapability(session, capability) {
  const granted = normalizeCapabilityList(session?.capabilities || []);
  return granted.includes(normalizeCapability(capability));
}

export function capabilitiesPayload(granted = ALLOWED_CAPABILITIES, { agentRole = null } = {}) {
  return {
    ok: true,
    role: BRIDGE_ROLE,
    agentRole: agentRole || null,
    protocolVersion: PROTOCOL_VERSION,
    version: 2,
    allowed: [...ALLOWED_CAPABILITIES],
    v1: [...V1_CAPABILITIES],
    draftCapabilities: [...DRAFT_CAPABILITIES],
    granted: normalizeCapabilityList(granted),
    denied: [...DENIED_ACTIONS],
    notes: [
      "Draft capabilities are explicit per pairing/session.",
      "Good Post Reviews / CONTENT_OPERATOR may create and submit drafts.",
      "MR ENTREPRENEUR / CAMPAIGN_STRATEGIST remains proposal-first unless granted draft capabilities.",
      "Proposals and content drafts are distinct objects.",
      "APPROVED does not mean PUBLISHED. Automatic provider dispatch is disabled.",
      "Unknown capabilities are denied. There is no wildcard.",
    ],
  };
}

export function isDeniedAction(action) {
  const key = normalizeCapability(action);
  if (!key) return false;
  if (DENIED_ACTIONS.includes(key)) return true;
  if (ALLOWED_CAPABILITIES.includes(key)) return false;
  return /PUBLISH|SCHEDULE_DIRECT|REPLY|SEND_MESSAGE|CONNECT_ACCOUNT|CHANGE_ACCOUNT|DISCONNECT|OAUTH|TOKEN|SECRET|WRITE_|EXECUTE_PROPOSAL|BYPASS_APPROVAL|APPROVE_CONTENT|FILESYSTEM|SHELL|PROCESS|READ_ENV|WRITE_ENV|DM\b/i.test(key);
}
