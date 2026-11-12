import { publicMediaReadiness } from "../media/publicProvider.js";
import { evaluatePublishGate } from "../../src/data/publishGate.js";

/**
 * Derive destination publish readiness from live account + media config.
 * Creative approval can exist while provider remains blocked.
 */
export function deriveDestinationReadiness(account, draft = {}) {
  if (!account) {
    return {
      connectionState: "MISSING",
      publishState: "PROVIDER_BLOCKED",
      code: "ACCOUNT_MISSING",
      label: "Destination account missing",
      blockingIssues: ["ACCOUNT_MISSING"],
    };
  }

  const connectionState = account.connectionState || "UNCONNECTED";
  const platform = String(account.platform || draft.platform || "").toLowerCase();
  const blockingIssues = [];

  if (connectionState !== "CONNECTED") {
    blockingIssues.push("NOT_CONNECTED");
  }

  if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
    blockingIssues.push(`PERMISSION_${account.publishPermission}`);
  }

  if (platform === "tiktok" && connectionState === "CONNECTED") {
    return {
      connectionState,
      publishState: "CONNECTED_ONLY",
      code: "CONNECTED_ONLY",
      label: "Connected only — publishing not enabled",
      blockingIssues: ["CONNECTED_ONLY"],
      platform: account.platform,
      handle: account.handle || account.displayName || "",
    };
  }

  if (platform === "instagram") {
    const media = publicMediaReadiness();
    if (media.status !== "READY") {
      blockingIssues.push("PUBLIC_MEDIA");
    }
  }

  if (platform === "facebook") {
    // pages_manage_posts / destination readiness is reflected by missing destination id or permission notes.
    if (!(account.providerAccountId || account.externalDestinationId)) {
      blockingIssues.push("PAGES_MANAGE_POSTS");
    }
  }

  // Reuse publish gate evaluation with a synthetic content shape — never publishes.
  const gate = evaluatePublishGate({
    account,
    content: {
      id: draft.id || "preview",
      managedProfileId: draft.workspaceId || draft.managedProfileId,
      caption: draft.caption || "",
      title: draft.title || "",
      mediaRefs: draft.mediaRefs || [],
      privacyStatus: "private",
    },
    approval: null,
    workspaceId: draft.workspaceId || draft.managedProfileId || "",
  });
  if (!gate.ok && gate.code && !["FRESH_APPROVAL_REQUIRED", "APPROVAL_EXPIRED", "APPROVAL_CONSUMED"].includes(gate.code)) {
    if (!blockingIssues.includes(gate.code)) blockingIssues.push(gate.code);
  }

  if (connectionState === "CONNECTED" && blockingIssues.length === 0) {
    return {
      connectionState,
      publishState: "READY_FOR_CONTROLLED_PUBLISH",
      code: "READY_FOR_CONTROLLED_PUBLISH",
      label: "Ready for controlled publish",
      blockingIssues: [],
      platform: account.platform,
      handle: account.handle || account.displayName || "",
    };
  }

  return {
    connectionState,
    publishState: "PROVIDER_BLOCKED",
    code: blockingIssues[0] || "PROVIDER_BLOCKED",
    label: blockingIssues.includes("PUBLIC_MEDIA")
      ? "Publish blocked — public media"
      : blockingIssues.includes("PAGES_MANAGE_POSTS")
        ? "Publish blocked — pages_manage_posts"
        : "Publish blocked",
    blockingIssues,
    platform: account.platform,
    handle: account.handle || account.displayName || "",
  };
}

export function creativeVsProviderState(draft, providerReadiness) {
  const creativeApproved = draft?.approvalStatus === "APPROVED";
  const providerBlocked = providerReadiness?.publishState !== "READY_FOR_CONTROLLED_PUBLISH";
  return {
    creativeApprovalState: creativeApproved ? "CREATIVE_APPROVED" : (draft?.approvalStatus || "NONE"),
    providerState: providerBlocked ? "PROVIDER_BLOCKED" : "PROVIDER_READY",
    publishReady: creativeApproved && !providerBlocked,
  };
}
