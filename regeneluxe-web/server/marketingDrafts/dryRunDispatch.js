/**
 * Provider-neutral DRY RUN dispatch harness.
 * Simulates schedule arrival → eligibility → approval → readiness → duplicate check → simulated result.
 * ZERO external provider writes.
 */

import { createHash } from "node:crypto";
import { scheduledPublishEligibility } from "./model.js";

export const DRY_RUN_RESULT_KIND = "DRY_RUN_PROVIDER_RESULT";

export function dryRunDuplicateKey(draft = {}) {
  const payload = [
    draft.id || "",
    draft.destinationAccountId || "",
    draft.platform || "",
    draft.scheduledFor || "",
    draft.caption || "",
  ].join("|");
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * @param {object} draft
 * @param {{ providerReady?: boolean, priorDispatchKeys?: string[], now?: string }} [options]
 */
export function executeDryRunDispatch(draft, {
  providerReady = false,
  priorDispatchKeys = [],
  now = new Date().toISOString(),
} = {}) {
  const eligibility = scheduledPublishEligibility(draft, { providerReady });
  const approvalOk = draft.approvalStatus === "APPROVED" && draft.status === "APPROVED";
  const duplicateKey = dryRunDuplicateKey(draft);
  const duplicate = priorDispatchKeys.includes(duplicateKey);

  const checks = {
    scheduledTimeArrived: true,
    eligibilityRechecked: eligibility.ELIGIBLE_FOR_SCHEDULED_PUBLISH,
    approvalRechecked: approvalOk,
    providerReadinessRechecked: Boolean(providerReady),
    duplicateProtectionRechecked: !duplicate,
  };

  const blockedReasons = [];
  if (!eligibility.ELIGIBLE_FOR_SCHEDULED_PUBLISH) blockedReasons.push("NOT_ELIGIBLE");
  if (!approvalOk) blockedReasons.push("APPROVAL_REQUIRED");
  if (!providerReady) blockedReasons.push("PROVIDER_NOT_READY");
  if (duplicate) blockedReasons.push("DUPLICATE_SUPPRESSED");

  const ok = blockedReasons.length === 0;

  return {
    DRY_RUN: true,
    kind: DRY_RUN_RESULT_KIND,
    ok,
    simulated: true,
    providerWrite: false,
    draftId: draft.id || null,
    workspaceId: draft.workspaceId || draft.managedProfileId || null,
    platform: draft.platform || "",
    destinationAccountId: draft.destinationAccountId || "",
    checks,
    eligibility,
    duplicateKey,
    blockedReasons,
    simulatedProviderResult: ok
      ? {
        status: "SIMULATED_SUCCESS",
        providerPostId: `dryrun_${duplicateKey.slice(0, 12)}`,
        recordedAt: now,
        note: "Simulated only. Not a real provider post.",
      }
      : {
        status: "SIMULATED_BLOCKED",
        providerPostId: null,
        recordedAt: now,
        note: "Dry-run blocked before simulated dispatch.",
        reasons: blockedReasons,
      },
    note: "DRY_RUN = true. Provider result must never be confused with a real post.",
  };
}
