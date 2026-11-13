/**
 * Compact catalog of known external agents for the connection wizard.
 * Roles remain enforced by capabilities.js / roles.js.
 */

import { AGENT_ROLES, ROLE_DEFAULT_CAPABILITIES } from "./roles.js";

const DENIED_PLAIN = Object.freeze([
  "Cannot approve content",
  "Cannot publish",
  "Cannot access OAuth",
  "Cannot access credentials or secrets",
  "Cannot control files or processes",
  "Cannot schedule directly or bypass approval",
]);

function permissionPlainEnglish(capabilities = []) {
  const map = {
    READ_PRODUCT_CONTEXT: "Read product context",
    READ_WORKSPACE_SUMMARY: "Read workspace summary",
    READ_ACCOUNT_METADATA: "Read account metadata",
    READ_CAMPAIGN_SUMMARY: "Read campaign information",
    READ_CONTENT_METADATA: "Read content metadata",
    READ_ANALYTICS_SUMMARY: "Read analytics summaries",
    READ_INBOX_SUMMARY: "Read inbox summary counts",
    READ_OPERATIONAL_HEALTH: "Read provider readiness / operational health",
    SUBMIT_PROPOSAL: "Submit recommendations / proposals",
    CREATE_CONTENT_DRAFT: "Create drafts",
    UPDATE_OWN_CONTENT_DRAFT: "Update own drafts",
    SUBMIT_CONTENT_FOR_APPROVAL: "Submit drafts for approval",
    READ_APPROVAL_STATUS: "Read approval status",
    READ_SCHEDULE_ASSIGNMENT: "Read schedule assignment",
  };
  return capabilities.map((cap) => map[cap] || cap);
}

export const AGENT_CATALOG = Object.freeze([
  Object.freeze({
    key: "mr_entrepreneur",
    label: "MR ENTREPRENEUR",
    subtitle: "Strategy & Rollout",
    agentType: "mr_entrepreneur",
    displayName: "MR ENTREPRENEUR",
    role: AGENT_ROLES.CAMPAIGN_STRATEGIST,
    roleLabel: "Campaign Strategist",
    match: /mr\s*entrepreneur|campaign\s*strategist|entrepreneur/i,
  }),
  Object.freeze({
    key: "mr_post",
    label: "MR POST",
    subtitle: "Content Operator",
    agentType: "mr_post",
    displayName: "MR POST",
    role: AGENT_ROLES.CONTENT_OPERATOR,
    roleLabel: "Content Operator",
    match: /mr\s*post|good\s*post|content\s*operator/i,
  }),
  Object.freeze({
    key: "other",
    label: "Other trusted agent",
    subtitle: "Trusted Analyst",
    agentType: "trusted_agent",
    displayName: "Trusted Agent",
    role: AGENT_ROLES.TRUSTED_ANALYST,
    roleLabel: "Trusted Analyst",
    match: null,
  }),
]);

export function getAgentPreset(key) {
  const normalized = String(key || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  return AGENT_CATALOG.find((row) => row.key === normalized) || null;
}

export function agentCatalogPublic() {
  return AGENT_CATALOG.map((agent) => {
    const capabilities = [...(ROLE_DEFAULT_CAPABILITIES[agent.role] || [])];
    return {
      key: agent.key,
      label: agent.label,
      subtitle: agent.subtitle,
      agentType: agent.agentType,
      displayName: agent.displayName,
      role: agent.role,
      roleLabel: agent.roleLabel,
      allowedPlain: permissionPlainEnglish(capabilities),
      deniedPlain: [...DENIED_PLAIN],
      defaultCapabilities: capabilities,
    };
  });
}

export function matchHandshakeToPreset(preset, { agentType = "", displayName = "" } = {}) {
  if (!preset || preset.key === "other") return { ok: true };
  const blob = `${agentType} ${displayName}`;
  if (preset.match && preset.match.test(blob)) return { ok: true };
  const typeOk = String(agentType || "").trim().toLowerCase() === preset.agentType;
  const nameOk = String(displayName || "").trim().toLowerCase() === String(preset.displayName || "").toLowerCase();
  if (typeOk || nameOk) return { ok: true };
  return {
    ok: false,
    code: "WRONG_AGENT",
    error: `This pairing was issued for ${preset.label}. A different agent presented the credential.`,
  };
}

export function rosterFromSession(session) {
  return AGENT_CATALOG.filter((row) => row.key !== "other").map((agent) => {
    const connected = Boolean(
      session
      && (
        String(session.agentRole || "") === agent.role
        || agent.match?.test(`${session.agentType || ""} ${session.displayName || ""}`)
        || String(session.agentType || "").toLowerCase() === agent.agentType
      ),
    );
    return {
      key: agent.key,
      label: agent.label,
      subtitle: agent.subtitle,
      role: agent.role,
      roleLabel: agent.roleLabel,
      status: connected ? "CONNECTED" : "DISCONNECTED",
      session: connected ? session : null,
    };
  });
}
