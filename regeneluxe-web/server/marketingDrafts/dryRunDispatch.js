/**
 * Provider-neutral DRY RUN execution path.
 * Shares eligibility/recheck with real dispatch; never writes to providers.
 */

import { prepareScheduledDispatch } from "./dispatchPipeline.js";
import { dryRunDuplicateKey as legacyKey } from "./dispatchKeys.js";

export const DRY_RUN_RESULT_KIND = "DRY_RUN_PROVIDER_RESULT";

export function dryRunDuplicateKey(draft = {}) {
  return legacyKey(draft);
}

/**
 * @param {object} draft
 * @param {{
 *   account?: object|null,
 *   providerReady?: boolean,
 *   priorDispatchKeys?: string[],
 *   now?: string|number,
 * }} [options]
 */
export async function executeDryRunDispatch(draft, {
  account = null,
  priorDispatchKeys = [],
  now = Date.now(),
} = {}) {
  const duplicateKey = dryRunDuplicateKey(draft);
  const priorAttemptExists = priorDispatchKeys.includes(duplicateKey);
  const prepared = await prepareScheduledDispatch(draft, account, {
    dryRun: true,
    now,
    priorAttemptExists,
  });

  return {
    DRY_RUN: true,
    kind: DRY_RUN_RESULT_KIND,
    ok: prepared.ok && prepared.stage === "SIMULATED_SUCCESS",
    simulated: true,
    providerWrite: false,
    draftId: draft.id || null,
    workspaceId: draft.workspaceId || draft.managedProfileId || null,
    platform: draft.platform || "",
    destinationAccountId: draft.destinationAccountId || "",
    checks: {
      scheduledTimeArrived: true,
      eligibilityRechecked: Boolean(prepared.eligibility?.ELIGIBLE_FOR_SCHEDULED_PUBLISH),
      approvalRechecked: !prepared.reasons?.includes("APPROVAL_INVALIDATED"),
      providerReadinessRechecked: prepared.readiness?.publishState === "READY_FOR_CONTROLLED_PUBLISH",
      duplicateProtectionRechecked: !priorAttemptExists,
    },
    eligibility: prepared.eligibility,
    duplicateKey,
    blockedReasons: prepared.reasons || [],
    simulatedProviderResult: prepared.simulatedProviderResult || {
      status: "SIMULATED_BLOCKED",
      providerPostId: null,
      recordedAt: new Date(typeof now === "number" ? now : Date.parse(now)).toISOString(),
      note: "Dry-run blocked before simulated dispatch.",
      reasons: prepared.reasons || [],
    },
    note: "DRY_RUN = true. Provider result must never be confused with a real post.",
  };
}
