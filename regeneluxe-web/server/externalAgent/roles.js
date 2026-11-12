/**
 * Marketing-agent role intent for the External Agent Bridge.
 * Capabilities remain explicit per pairing/session — roles guide defaults and enforcement.
 */

export const AGENT_ROLES = Object.freeze({
  CONTENT_OPERATOR: "CONTENT_OPERATOR",
  CAMPAIGN_STRATEGIST: "CAMPAIGN_STRATEGIST",
  TRUSTED_ANALYST: "TRUSTED_ANALYST",
});

export const DRAFT_CAPABILITIES = Object.freeze([
  "CREATE_CONTENT_DRAFT",
  "UPDATE_OWN_CONTENT_DRAFT",
  "SUBMIT_CONTENT_FOR_APPROVAL",
  "READ_APPROVAL_STATUS",
  "READ_SCHEDULE_ASSIGNMENT",
]);

export const ROLE_DEFAULT_CAPABILITIES = Object.freeze({
  CONTENT_OPERATOR: Object.freeze([
    "READ_PRODUCT_CONTEXT",
    "READ_WORKSPACE_SUMMARY",
    "READ_ACCOUNT_METADATA",
    "READ_CAMPAIGN_SUMMARY",
    "READ_CONTENT_METADATA",
    "READ_ANALYTICS_SUMMARY",
    "READ_INBOX_SUMMARY",
    "READ_OPERATIONAL_HEALTH",
    "SUBMIT_PROPOSAL",
    ...DRAFT_CAPABILITIES,
  ]),
  CAMPAIGN_STRATEGIST: Object.freeze([
    "READ_PRODUCT_CONTEXT",
    "READ_WORKSPACE_SUMMARY",
    "READ_ACCOUNT_METADATA",
    "READ_CAMPAIGN_SUMMARY",
    "READ_CONTENT_METADATA",
    "READ_ANALYTICS_SUMMARY",
    "READ_INBOX_SUMMARY",
    "READ_OPERATIONAL_HEALTH",
    "SUBMIT_PROPOSAL",
    "READ_APPROVAL_STATUS",
    "READ_SCHEDULE_ASSIGNMENT",
  ]),
  TRUSTED_ANALYST: Object.freeze([
    "READ_PRODUCT_CONTEXT",
    "READ_WORKSPACE_SUMMARY",
    "READ_ACCOUNT_METADATA",
    "READ_CAMPAIGN_SUMMARY",
    "READ_CONTENT_METADATA",
    "READ_ANALYTICS_SUMMARY",
    "READ_INBOX_SUMMARY",
    "READ_OPERATIONAL_HEALTH",
    "SUBMIT_PROPOSAL",
  ]),
});

export const CAPABILITY_REQUIRED_ROLES = Object.freeze({
  CREATE_CONTENT_DRAFT: [AGENT_ROLES.CONTENT_OPERATOR],
  UPDATE_OWN_CONTENT_DRAFT: [AGENT_ROLES.CONTENT_OPERATOR],
  SUBMIT_CONTENT_FOR_APPROVAL: [AGENT_ROLES.CONTENT_OPERATOR],
  READ_APPROVAL_STATUS: [AGENT_ROLES.CONTENT_OPERATOR, AGENT_ROLES.CAMPAIGN_STRATEGIST, AGENT_ROLES.TRUSTED_ANALYST],
  READ_SCHEDULE_ASSIGNMENT: [AGENT_ROLES.CONTENT_OPERATOR, AGENT_ROLES.CAMPAIGN_STRATEGIST, AGENT_ROLES.TRUSTED_ANALYST],
});

export function normalizeAgentRole(value, { agentType = "", displayName = "" } = {}) {
  const raw = String(value || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (Object.values(AGENT_ROLES).includes(raw)) return raw;

  const hint = `${agentType} ${displayName}`.toLowerCase();
  if (/good\s*post|mr\s*post|content\s*operator/.test(hint)) return AGENT_ROLES.CONTENT_OPERATOR;
  if (/entrepreneur|campaign\s*strategist|mr\s*ent/.test(hint)) return AGENT_ROLES.CAMPAIGN_STRATEGIST;
  return AGENT_ROLES.TRUSTED_ANALYST;
}

export function roleAllowsCapability(role, capability) {
  const required = CAPABILITY_REQUIRED_ROLES[String(capability || "").toUpperCase()];
  if (!required) return true;
  return required.includes(normalizeAgentRole(role));
}
