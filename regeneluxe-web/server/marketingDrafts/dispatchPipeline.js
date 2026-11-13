/**
 * Shared schedule-dispatch eligibility pipeline.
 * Used by dry-run and real execution so both stop at the same gates.
 * Real path may proceed to PUBLISH_CONTENT; dry-run stops before provider write.
 */

import { getMeta } from "../db/index.js";
import { draftApprovalFingerprint, scheduledPublishEligibility } from "./model.js";
import { deriveDestinationReadiness } from "./providerReadiness.js";
import { assertApprovalStillValid } from "./service.js";

export const SCHEDULE_WINDOW_MS = 15 * 60 * 1000;
export const PUBLISHING_PAUSE_META_KEY = "scheduled_publishing_paused";

export const DISPATCH_SKIP_REASONS = Object.freeze({
  PROVIDER_NOT_READY: "PROVIDER_NOT_READY",
  RELEASE_GATE_BLOCKED: "RELEASE_GATE_BLOCKED",
  APPROVAL_INVALIDATED: "APPROVAL_INVALIDATED",
  APPROVAL_DEADLINE_MISSED: "APPROVAL_DEADLINE_MISSED",
  SCHEDULE_WINDOW_MISSED: "SCHEDULE_WINDOW_MISSED",
  DESTINATION_CHANGED: "DESTINATION_CHANGED",
  DUPLICATE_SUPPRESSED: "DUPLICATE_SUPPRESSED",
  PAUSED: "PAUSED",
  NOT_ELIGIBLE: "NOT_ELIGIBLE",
  WORKSPACE_MISMATCH: "WORKSPACE_MISMATCH",
  MISSING_DESTINATION: "MISSING_DESTINATION",
  FINGERPRINT_MISMATCH: "FINGERPRINT_MISMATCH",
});

export async function isScheduledPublishingPaused() {
  const raw = await getMeta(PUBLISHING_PAUSE_META_KEY);
  return raw === "1" || raw === "true" || raw === true;
}

/**
 * Full pre-write recheck. Never performs provider writes.
 * @param {object} draft
 * @param {object|null} account
 * @param {{
 *   dryRun?: boolean,
 *   now?: number|Date|string,
 *   priorAttemptExists?: boolean,
 *   expectedFingerprint?: string|null,
 * }} [opts]
 */
export async function recheckScheduledDispatch(draft, account, {
  dryRun = false,
  now = Date.now(),
  priorAttemptExists = false,
  expectedFingerprint = null,
} = {}) {
  const nowMs = typeof now === "number" ? now : Date.parse(now);
  const reasons = [];
  const paused = await isScheduledPublishingPaused();
  if (paused) reasons.push(DISPATCH_SKIP_REASONS.PAUSED);

  if (!draft?.workspaceId && !draft?.managedProfileId) {
    reasons.push(DISPATCH_SKIP_REASONS.WORKSPACE_MISMATCH);
  }
  if (!draft?.destinationAccountId) {
    reasons.push(DISPATCH_SKIP_REASONS.MISSING_DESTINATION);
  }
  if (account && draft?.destinationAccountId && account.id !== draft.destinationAccountId) {
    reasons.push(DISPATCH_SKIP_REASONS.DESTINATION_CHANGED);
  }
  if (account && draft?.workspaceId && account.managedProfileId && account.managedProfileId !== draft.workspaceId) {
    reasons.push(DISPATCH_SKIP_REASONS.WORKSPACE_MISMATCH);
  }

  const approval = await assertApprovalStillValid(draft.id).catch(() => ({ ok: false, code: "NOT_APPROVED" }));
  if (!approval?.ok) {
    reasons.push(
      approval?.code === "APPROVAL_FINGERPRINT_MISMATCH"
        ? DISPATCH_SKIP_REASONS.FINGERPRINT_MISMATCH
        : DISPATCH_SKIP_REASONS.APPROVAL_INVALIDATED,
    );
  }

  const liveFingerprint = draftApprovalFingerprint(draft);
  if (expectedFingerprint && expectedFingerprint !== liveFingerprint) {
    reasons.push(DISPATCH_SKIP_REASONS.FINGERPRINT_MISMATCH);
  }

  if (draft.approvalDeadline) {
    const deadline = Date.parse(draft.approvalDeadline);
    if (Number.isFinite(deadline) && nowMs > deadline && draft.approvalStatus !== "APPROVED") {
      reasons.push(DISPATCH_SKIP_REASONS.APPROVAL_DEADLINE_MISSED);
    }
  }

  const scheduledMs = Date.parse(draft.scheduledFor || "");
  if (Number.isFinite(scheduledMs) && nowMs > scheduledMs + SCHEDULE_WINDOW_MS) {
    reasons.push(DISPATCH_SKIP_REASONS.SCHEDULE_WINDOW_MISSED);
  }

  const readiness = deriveDestinationReadiness(account, draft);
  const providerReady = readiness.publishState === "READY_FOR_CONTROLLED_PUBLISH";
  if (!providerReady) reasons.push(DISPATCH_SKIP_REASONS.PROVIDER_NOT_READY);

  if (draft.releaseGateState === "BLOCKED") {
    reasons.push(DISPATCH_SKIP_REASONS.RELEASE_GATE_BLOCKED);
  }

  const eligibility = scheduledPublishEligibility(draft, { providerReady });
  if (!eligibility.ELIGIBLE_FOR_SCHEDULED_PUBLISH) {
    reasons.push(DISPATCH_SKIP_REASONS.NOT_ELIGIBLE);
  }

  if (priorAttemptExists) {
    reasons.push(DISPATCH_SKIP_REASONS.DUPLICATE_SUPPRESSED);
  }

  const uniqueReasons = [...new Set(reasons)];
  const ok = uniqueReasons.length === 0;

  return {
    ok,
    dryRun: Boolean(dryRun),
    providerWrite: false,
    reasons: uniqueReasons,
    blocker: uniqueReasons[0] || null,
    eligibility,
    readiness,
    fingerprint: liveFingerprint,
    paused,
    scheduledFor: draft.scheduledFor || null,
    workspaceId: draft.workspaceId || draft.managedProfileId || null,
    draftId: draft.id || null,
    destinationAccountId: draft.destinationAccountId || null,
    note: dryRun
      ? "Dry-run shared eligibility. Stops before provider write."
      : "Real dispatch eligibility. Provider write only if ok=true and caller proceeds.",
  };
}

/**
 * Shared dry/real preparation. Dry-run never writes.
 */
export async function prepareScheduledDispatch(draft, account, opts = {}) {
  const check = await recheckScheduledDispatch(draft, account, opts);
  if (!check.ok) {
    return {
      ...check,
      stage: "BLOCKED",
      simulatedProviderResult: opts.dryRun
        ? {
          status: "SIMULATED_BLOCKED",
          reasons: check.reasons,
          dryRun: true,
        }
        : null,
    };
  }
  if (opts.dryRun) {
    return {
      ...check,
      stage: "SIMULATED_SUCCESS",
      providerWrite: false,
      simulatedProviderResult: {
        status: "SIMULATED_SUCCESS",
        dryRun: true,
        providerPostId: `dryrun_${String(draft.id || "draft").slice(0, 12)}`,
        recordedAt: new Date(typeof opts.now === "number" ? opts.now : Date.now()).toISOString(),
        note: "Simulated only. Not a real provider post.",
      },
    };
  }
  return {
    ...check,
    stage: "READY_TO_WRITE",
    providerWrite: true,
  };
}
