/**
 * Connection Certification matrix for a workspace.
 * Honest status only — never marks GREEN without verified identity + readiness.
 * Does not perform provider writes.
 */

import { listProviderDefinitions, normalizeProviderId } from "../connectors/registry.js";
import { CAPABILITY, hasCapabilityIn } from "../connectors/capabilities.js";
import { hasAccountTokens, publicProviderVaultStatus } from "../secrets/providers.js";
import { normalizeWorkspacePurpose } from "../../src/data/profileModels.js";
import { facebookPagePostGrant } from "../connectors/providers/metaGraph.js";
import { publicMediaReadiness } from "../media/publicProvider.js";

export const CERT_STATUSES = Object.freeze(["GREEN", "YELLOW", "RED", "UNKNOWN"]);

export const RELEASE_CRITICAL = Object.freeze(["instagram", "facebook", "youtube", "tiktok"]);
export const REPORT_ONLY = Object.freeze(["twitch", "kick", "linkedin"]);

function accountForProvider(accounts, provider) {
  const id = normalizeProviderId(provider);
  return (accounts || []).find((row) => normalizeProviderId(row.platform || row.provider) === id) || null;
}

function vaultRowForAccount(provider, accountId) {
  return publicProviderVaultStatus().accounts.find((row) => (
    row.provider === provider && row.accountId === accountId
  )) || null;
}

function identityFromAccount(account) {
  if (!account) {
    return {
      externalAccountId: "",
      displayName: "",
      handle: "",
      workspaceAssociation: "",
    };
  }
  return {
    externalAccountId: String(account.externalAccountId || account.channelId || account.pageId || ""),
    displayName: String(account.displayName || account.channelTitle || account.pageName || ""),
    handle: String(account.handle || account.channelHandle || account.username || ""),
    workspaceAssociation: String(account.managedProfileId || account.workspaceId || ""),
  };
}

/**
 * Build one provider certification row for the active workspace.
 * Controlled real provider tests are never marked passed here.
 */
export function buildProviderCertificationRow({
  provider,
  displayName,
  workspace,
  account = null,
  definition = null,
  controlledRealTestPassed = false,
} = {}) {
  const providerId = normalizeProviderId(provider);
  const purpose = normalizeWorkspacePurpose(workspace?.workspacePurpose);
  const connected = Boolean(account && (account.connectionState === "CONNECTED" || account.status === "CONNECTED"));
  const identity = identityFromAccount(account);
  const identityVerified = Boolean(
    connected
    && identity.externalAccountId
    && (!identity.workspaceAssociation || identity.workspaceAssociation === workspace?.id),
  );
  const vault = account ? vaultRowForAccount(providerId, account.id) : null;
  const vaultHealthy = Boolean(connected && account && hasAccountTokens(providerId, account.id));
  const caps = definition?.capabilities || [];
  const canRead = connected && (
    hasCapabilityIn(caps, CAPABILITY.READ_PROFILE)
    || hasCapabilityIn(caps, CAPABILITY.READ_CONTENT)
  );
  const canAnalyze = connected && (
    hasCapabilityIn(caps, CAPABILITY.READ_ACCOUNT_METRICS)
    || hasCapabilityIn(caps, CAPABILITY.READ_CONTENT_METRICS)
  );
  const publishImplemented = Boolean(definition?.publishingSupport);
  const readiness = definition?.readiness || "UNSUPPORTED";
  const providerReady = readiness === "IMPLEMENTED" && connected && vaultHealthy && identityVerified;

  const blockers = [];
  if (purpose !== "TEST" && purpose !== "PRODUCTION") {
    blockers.push("WORKSPACE_PURPOSE_UNKNOWN");
  }
  if (!connected) blockers.push("NOT_CONNECTED");
  if (connected && !identity.externalAccountId) blockers.push("IDENTITY_NOT_VERIFIED");
  if (identity.workspaceAssociation && workspace?.id && identity.workspaceAssociation !== workspace.id) {
    blockers.push("IDENTITY_WORKSPACE_MISMATCH");
  }
  if (connected && !vaultHealthy) blockers.push("CREDENTIAL_VAULT_MISSING");
  if (!publishImplemented) blockers.push("PUBLISH_NOT_IMPLEMENTED");
  if (readiness === "UNSUPPORTED") blockers.push("PROVIDER_UNSUPPORTED");
  if (readiness === "PROVIDER_REVIEW_REQUIRED") blockers.push("PROVIDER_REVIEW_REQUIRED");
  if (readiness === "SETUP_REQUIRED") blockers.push("SETUP_REQUIRED");
  if (providerId === "instagram") {
    const media = publicMediaReadiness();
    if (media.status !== "READY") blockers.push(`PUBLIC_MEDIA_${media.status || "NOT_READY"}`);
  }
  if (providerId === "facebook" && connected) {
    const grant = vault ? facebookPagePostGrant(vault.scopes) : false;
    if (!grant) blockers.push("pages_manage_posts_MISSING");
  }
  if (!controlledRealTestPassed) blockers.push("CONTROLLED_REAL_TEST_PENDING");

  let status = "RED";
  if (connected && identityVerified && vaultHealthy && publishImplemented && readiness === "IMPLEMENTED" && controlledRealTestPassed) {
    status = "GREEN";
  } else if (connected || readiness === "IMPLEMENTED" || readiness === "SETUP_REQUIRED") {
    status = "YELLOW";
  }

  // Honest rule: no GREEN until controlled real test + Test Lab path complete.
  if (status === "GREEN" && purpose !== "TEST" && !controlledRealTestPassed) {
    status = "YELLOW";
    blockers.push("PRODUCTION_PROMOTION_PENDING");
  }
  if (status === "GREEN" && blockers.length) {
    status = "YELLOW";
  }

  return {
    provider: providerId,
    displayName: displayName || definition?.displayName || providerId,
    releaseCritical: RELEASE_CRITICAL.includes(providerId),
    identity,
    connected,
    identityVerified,
    canRead: Boolean(canRead),
    canAnalyze: Boolean(canAnalyze),
    canPublish: publishImplemented && providerReady && !blockers.includes("pages_manage_posts_MISSING"),
    publishImplemented,
    readyForControlledPublish: providerReady && blockers.every((b) => b === "CONTROLLED_REAL_TEST_PENDING"),
    readiness,
    vaultHealthy,
    lastTestAt: account?.lastVerifiedAt || account?.lastSuccessfulSyncAt || null,
    status,
    blocker: blockers[0] || null,
    blockers,
    dryRunOnly: true,
    note: "No provider writes during automated certification. Controlled real tests require explicit operator authorization.",
  };
}

export function buildConnectionCertificationMatrix({
  workspace = null,
  accounts = [],
  controlledRealTests = {},
} = {}) {
  const defs = listProviderDefinitions().filter((row) => row.provider !== "mock");
  const wanted = [...RELEASE_CRITICAL, ...REPORT_ONLY];
  const rows = wanted.map((providerId) => {
    const definition = defs.find((row) => row.provider === providerId) || null;
    const account = accountForProvider(accounts, providerId);
    return buildProviderCertificationRow({
      provider: providerId,
      displayName: definition?.displayName,
      workspace,
      account,
      definition,
      controlledRealTestPassed: Boolean(controlledRealTests[providerId]),
    });
  });

  const critical = rows.filter((row) => row.releaseCritical);
  const anyGreen = critical.every((row) => row.status === "GREEN");
  const anyConnected = critical.some((row) => row.connected);
  let systemStatus = "RED";
  if (anyGreen) systemStatus = "GREEN";
  else if (anyConnected || critical.some((row) => row.status === "YELLOW")) systemStatus = "YELLOW";

  return {
    workspaceId: workspace?.id || null,
    workspaceName: workspace?.displayName || "",
    workspacePurpose: normalizeWorkspacePurpose(workspace?.workspacePurpose),
    generatedAt: new Date().toISOString(),
    providers: rows,
    system: {
      status: systemStatus,
      blocker: anyGreen
        ? null
        : (critical.find((row) => row.blocker)?.blocker || "TEST_LAB_AND_CONTROLLED_TESTS_REQUIRED"),
      note: "System cannot be READY_FOR_PRODUCTION_AUTOMATION until controlled real provider tests pass in the Test Lab.",
    },
  };
}
