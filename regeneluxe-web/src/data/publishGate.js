import { classifyMediaUrl } from "./mediaReadiness.js";
import {
  explainApprovalRejection,
  isPilotProvider,
  publishFingerprint,
  variantForAccount,
} from "./publishApproval.js";

const TEXT_PROVIDERS = new Set(["facebook", "threads"]);
const PUBLIC_URL_PROVIDERS = new Set(["instagram"]);

/**
 * Runs before any provider HTTP call.
 * Pilot providers ignore AUTO_PUBLISH, READY, an active campaign, and payload.approved.
 */
export function evaluatePublishGate({
  account,
  content,
  approval = null,
  workspaceId = "",
  operatorId = "",
  now = Date.now(),
} = {}) {
  if (!account) return block("ACCOUNT_MISSING");
  if (!content) return block("CONTENT_MISSING");
  const provider = String(account.platform || "").toLowerCase();
  if (workspaceId && account.managedProfileId && account.managedProfileId !== workspaceId) {
    return block("WORKSPACE_MISMATCH");
  }
  if (workspaceId && content.managedProfileId && content.managedProfileId !== workspaceId) {
    return block("WORKSPACE_MISMATCH");
  }
  if (account.connectionState !== "CONNECTED") return block("ACCOUNT_NOT_CONNECTED");
  if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
    return block("PERMISSION_BLOCKS_PUBLISH");
  }

  const variant = variantForAccount(content, account);
  const destinationId = account.providerAccountId || account.externalDestinationId || "";
  if (!destinationId) return block("DESTINATION_MISSING");

  if (provider === "youtube") {
    if (String(content.privacyStatus || "private").toLowerCase() !== "private") {
      return block("YOUTUBE_PILOT_PRIVATE_ONLY");
    }
    if (!variant.mediaRef && !content.videoPath) return block("MEDIA_REQUIRED");
  }

  if (TEXT_PROVIDERS.has(provider) && !String(variant.caption || variant.title || "").trim()) {
    return block("TEXT_REQUIRED");
  }

  if (PUBLIC_URL_PROVIDERS.has(provider) && classifyMediaUrl(variant.mediaRef) !== "PUBLIC_PROVIDER_MEDIA") {
    return block("MEDIA_PUBLIC_URL_REQUIRED");
  }

  if (isPilotProvider(provider)) {
    const reason = explainApprovalRejection(approval, {
      operatorId,
      managedProfileId: workspaceId || account.managedProfileId || "",
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      accountId: account.id,
      provider,
      externalDestinationId: destinationId,
      mediaRef: variant.mediaRef || "",
    }, now);
    if (reason) return block(reason);
  }

  return { ok: true, provider, variant, destinationId };
}

function block(code) {
  return { ok: false, code, error: code };
}
