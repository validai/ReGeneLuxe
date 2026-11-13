import { initDb, list, get, upsert, COLLECTIONS } from "../db/index.js";
import {
  APPROVAL_KIND,
  DRAFT_KIND,
  createApprovalId,
  draftApprovalFingerprint,
  emptyMarketingDraft,
  evaluateOutNowGuard,
  publicDraft,
  scheduledPublishEligibility,
  summarizeGateState,
  normalizeGateList,
  emptyGate,
} from "./model.js";
import { creativeVsProviderState, deriveDestinationReadiness } from "./providerReadiness.js";
import { resolveSafeAssets } from "./assets.js";
import { appendAudit, AUDIT as BRIDGE_AUDIT } from "../externalAgent/store.js";

export const DRAFT_AUDIT = Object.freeze({
  DRAFT_CREATED: "DRAFT_CREATED",
  DRAFT_UPDATED: "DRAFT_UPDATED",
  DRAFT_SUBMITTED: "DRAFT_SUBMITTED",
  CHANGES_REQUESTED: "CHANGES_REQUESTED",
  DRAFT_APPROVED: "DRAFT_APPROVED",
  DRAFT_SKIPPED: "DRAFT_SKIPPED",
  APPROVAL_EXPIRED: "APPROVAL_EXPIRED",
  SCHEDULE_ASSIGNED: "SCHEDULE_ASSIGNED",
});

export function isMarketingDraft(row) {
  return row && (row.kind === DRAFT_KIND || row.provenance === "MARKETING_AGENT");
}

async function auditDraft(action, { workspaceId, draftId, actorType, actorId, detail = {} }) {
  appendAudit({
    sessionId: actorType === "EXTERNAL_AGENT" ? actorId : null,
    agentId: actorType === "EXTERNAL_AGENT" ? actorId : null,
    action,
    detail: {
      workspaceId,
      draftId,
      actorType,
      operatorId: actorType === "OPERATOR" ? actorId : null,
      ...detail,
    },
  });
}

/** @param {{ workspaceId?: string|null, filter?: string }} [opts] */
export async function listMarketingDrafts({ workspaceId = null, filter = "all" } = {}) {
  await initDb();
  const now = Date.now();
  const rows = (await list(COLLECTIONS.content))
    .filter(isMarketingDraft)
    .filter((row) => !workspaceId || row.workspaceId === workspaceId || row.managedProfileId === workspaceId)
    .map((row) => maybeExpireDraftSync(row, now))
    .filter(Boolean);

  const enriched = [];
  for (const row of rows) {
    enriched.push(await enrichDraft(row));
  }

  return enriched.filter((draft) => matchesFilter(draft, filter, now));
}

function matchesFilter(draft, filter, now = Date.now()) {
  const key = String(filter || "all").toLowerCase();
  if (key === "all") return true;
  if (key === "needs_review" || key === "needs-review") return draft.status === "READY_FOR_REVIEW";
  if (key === "approved") return draft.status === "APPROVED" || draft.approvalStatus === "APPROVED";
  if (key === "skipped") return draft.status === "SKIPPED" || draft.status === "EXPIRED";
  if (key === "today") {
    const when = Date.parse(draft.scheduledFor || draft.requestedScheduledFor || "");
    if (!Number.isFinite(when)) return false;
    const start = new Date(now); start.setHours(0, 0, 0, 0);
    const end = new Date(now); end.setHours(23, 59, 59, 999);
    return when >= start.getTime() && when <= end.getTime();
  }
  if (key === "this_week" || key === "week") {
    const when = Date.parse(draft.scheduledFor || draft.requestedScheduledFor || "");
    if (!Number.isFinite(when)) return false;
    const start = new Date(now);
    const day = start.getDay();
    const diff = (day + 6) % 7; // Monday-start
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return when >= start.getTime() && when < end.getTime();
  }
  return true;
}

function maybeExpireDraftSync(row, now = Date.now()) {
  if (!row) return null;
  if (!["READY_FOR_REVIEW", "DRAFT", "CHANGES_REQUESTED"].includes(row.status)) return row;
  const deadline = Date.parse(row.approvalDeadline || "");
  if (!Number.isFinite(deadline) || deadline > now) return row;
  return {
    ...row,
    status: "SKIPPED",
    approvalStatus: "EXPIRED",
    updatedAt: new Date(now).toISOString(),
    expiredReason: "APPROVAL_DEADLINE_PASSED",
  };
}

async function persistExpired(draft) {
  if (draft.status === "SKIPPED" && draft.approvalStatus === "EXPIRED" && draft.expiredReason === "APPROVAL_DEADLINE_PASSED") {
    const existing = await get(COLLECTIONS.content, draft.id);
    if (existing && existing.status !== "SKIPPED") {
      await upsert(COLLECTIONS.content, draft);
      await auditDraft(DRAFT_AUDIT.APPROVAL_EXPIRED, {
        workspaceId: draft.workspaceId,
        draftId: draft.id,
        actorType: "SYSTEM",
        actorId: null,
      });
    }
  }
  return draft;
}

async function enrichDraft(draft) {
  const expired = await persistExpired(draft);
  const account = expired.destinationAccountId
    ? await get(COLLECTIONS.accounts, expired.destinationAccountId)
    : null;
  if (account && expired.workspaceId && account.managedProfileId && account.managedProfileId !== expired.workspaceId) {
    // Cross-workspace destination should never enrich.
  }
  const providerReadiness = deriveDestinationReadiness(
    account && (!expired.workspaceId || !account.managedProfileId || account.managedProfileId === expired.workspaceId)
      ? account
      : null,
    expired,
  );
  const creative = creativeVsProviderState(expired, providerReadiness);
  const outNow = evaluateOutNowGuard(expired);
  const assets = await resolveSafeAssets(expired.mediaRefs || [], {
    workspaceId: expired.workspaceId,
    campaignId: expired.campaignId,
  });
  const eligibility = scheduledPublishEligibility(expired, {
    providerReady: providerReadiness.publishState === "READY_FOR_CONTROLLED_PUBLISH",
  });
  return publicDraft({
    ...expired,
    providerReadiness,
    creativeApprovalState: creative.creativeApprovalState,
    providerState: creative.providerState,
    publishReady: creative.publishReady,
    outNowGuard: outNow,
    assets,
    scheduledPublishEligibility: eligibility,
    blockingIssues: [
      ...(providerReadiness.blockingIssues || []),
      ...(outNow.blocking ? outNow.issues : []),
      ...(expired.releaseGateState === "BLOCKED" ? ["RELEASE_GATES_BLOCKED"] : []),
    ],
  });
}

/** @param {string} draftId @param {{ workspaceId?: string|null }} [opts] */
export async function getMarketingDraft(draftId, { workspaceId = null } = {}) {
  await initDb();
  const row = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(row)) return null;
  if (workspaceId && row.workspaceId !== workspaceId && row.managedProfileId !== workspaceId) return null;
  return enrichDraft(maybeExpireDraftSync(row));
}

export async function createMarketingDraft(input, session) {
  await initDb();
  const workspaceId = session.workspaceId;
  if (!workspaceId) return { ok: false, status: 403, code: "WORKSPACE_REQUIRED", error: "Session is not workspace-bound." };

  if (input.destinationAccountId) {
    const account = await get(COLLECTIONS.accounts, input.destinationAccountId);
    if (!account || account.managedProfileId !== workspaceId) {
      return { ok: false, status: 403, code: "ACCOUNT_DENIED", error: "Destination account is outside this workspace." };
    }
  }
  if (input.campaignId) {
    const campaign = await get(COLLECTIONS.campaigns, input.campaignId);
    if (!campaign || campaign.managedProfileId !== workspaceId) {
      return { ok: false, status: 403, code: "CAMPAIGN_DENIED", error: "Campaign is outside this workspace." };
    }
  }

  const mediaRefs = (input.mediaRefs || []).map((item) => (typeof item === "string" ? item : String(item?.id || ""))).filter(Boolean);
  if (mediaRefs.some((id) => id.includes("/") || id.includes("\\") || id.startsWith("~"))) {
    return { ok: false, status: 400, code: "FILESYSTEM_PATH_DENIED", error: "mediaRefs must be ReGeneLuxe asset IDs, not filesystem paths." };
  }

  const draft = emptyMarketingDraft({
    ...input,
    // Agent may request a schedule, but authoritative scheduledFor is operator-controlled.
    scheduledFor: null,
    requestedScheduledFor: input.requestedScheduledFor || input.requestedSchedule || null,
    workspaceId,
    managedProfileId: workspaceId,
    createdByType: "EXTERNAL_AGENT",
    createdByAgentSessionId: session.id,
    createdByAgentName: session.displayName || session.agentType || "",
    createdByAgentRole: session.agentRole || "CONTENT_OPERATOR",
    createdByInstanceId: session.instanceId || "",
    status: "DRAFT",
    approvalStatus: "NONE",
  });

  await upsert(COLLECTIONS.content, draft);
  await auditDraft(DRAFT_AUDIT.DRAFT_CREATED, {
    workspaceId,
    draftId: draft.id,
    actorType: "EXTERNAL_AGENT",
    actorId: session.id,
  });
  return { ok: true, status: 200, draft: await enrichDraft(draft) };
}

const LOCKED_AFTER_APPROVAL = new Set([
  "destinationAccountId",
  "mediaRefs",
  "heroAssetId",
  "scheduledFor",
  "platform",
]);

export async function updateOwnMarketingDraft(draftId, patch, session) {
  await initDb();
  const existing = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(existing)) return { ok: false, status: 404, error: "Draft not found." };
  if (existing.workspaceId !== session.workspaceId && existing.managedProfileId !== session.workspaceId) {
    return { ok: false, status: 403, code: "WORKSPACE_DENIED", error: "Cross-workspace draft access denied." };
  }
  if (existing.createdByInstanceId && existing.createdByInstanceId !== session.instanceId) {
    return { ok: false, status: 403, code: "OWNERSHIP_DENIED", error: "Agents may only update their own drafts." };
  }
  if (["APPROVED", "SKIPPED", "EXPIRED"].includes(existing.status)) {
    for (const key of LOCKED_AFTER_APPROVAL) {
      if (patch[key] !== undefined && JSON.stringify(patch[key]) !== JSON.stringify(existing[key])) {
        return {
          ok: false,
          status: 403,
          code: "LOCKED_AFTER_APPROVAL",
          error: `Cannot change ${key} after approval. Re-approval would be required via a new draft revision path.`,
        };
      }
    }
  }

  if (patch.destinationAccountId) {
    const account = await get(COLLECTIONS.accounts, patch.destinationAccountId);
    if (!account || account.managedProfileId !== session.workspaceId) {
      return { ok: false, status: 403, code: "ACCOUNT_DENIED", error: "Destination account is outside this workspace." };
    }
  }

  const nextMedia = patch.mediaRefs !== undefined ? patch.mediaRefs : existing.mediaRefs;
  if (patch.mediaRefs) {
    const refs = patch.mediaRefs.map((item) => (typeof item === "string" ? item : String(item?.id || ""))).filter(Boolean);
    if (refs.some((id) => id.includes("/") || id.includes("\\") || id.startsWith("~"))) {
      return { ok: false, status: 400, code: "FILESYSTEM_PATH_DENIED", error: "mediaRefs must be ReGeneLuxe asset IDs, not filesystem paths." };
    }
  }

  const requiredGates = patch.requiredGates
    ? normalizeGateList(patch.requiredGates)
    : normalizeGateList((existing.releaseGates || []).map((g) => g.type));
  const releaseGates = requiredGates.map((type) => {
    const prev = (existing.releaseGates || []).find((g) => g.type === type);
    return emptyGate(type, prev?.state || "UNKNOWN");
  });

  const next = emptyMarketingDraft({
    ...existing,
    ...patch,
    id: existing.id,
    mediaRefs: nextMedia,
    releaseGates,
    // Never let agent set authoritative schedule.
    scheduledFor: existing.scheduledFor,
    requestedScheduledFor: patch.requestedScheduledFor !== undefined
      ? patch.requestedScheduledFor
      : (patch.requestedSchedule !== undefined ? patch.requestedSchedule : existing.requestedScheduledFor),
    workspaceId: existing.workspaceId,
    managedProfileId: existing.managedProfileId,
    createdByAgentSessionId: existing.createdByAgentSessionId,
    createdByAgentName: existing.createdByAgentName,
    createdByAgentRole: existing.createdByAgentRole,
    createdByInstanceId: existing.createdByInstanceId,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
    status: existing.status === "APPROVED" ? "DRAFT" : (existing.status === "READY_FOR_REVIEW" ? "DRAFT" : existing.status),
    approvalStatus: existing.approvalStatus === "APPROVED" || existing.approvalStatus === "PENDING"
      ? "INVALIDATED"
      : existing.approvalStatus,
    approvalId: null,
  });
  next.releaseGateState = summarizeGateState(next.releaseGates);

  // If bound fields changed while previously approved, invalidate.
  if (existing.approvalStatus === "APPROVED") {
    next.status = "DRAFT";
    next.approvalStatus = "INVALIDATED";
  }

  await upsert(COLLECTIONS.content, next);
  await auditDraft(DRAFT_AUDIT.DRAFT_UPDATED, {
    workspaceId: session.workspaceId,
    draftId: next.id,
    actorType: "EXTERNAL_AGENT",
    actorId: session.id,
  });
  return { ok: true, status: 200, draft: await enrichDraft(next) };
}

export async function submitMarketingDraft(draftId, session) {
  await initDb();
  const existing = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(existing)) return { ok: false, status: 404, error: "Draft not found." };
  if (existing.workspaceId !== session.workspaceId) {
    return { ok: false, status: 403, code: "WORKSPACE_DENIED", error: "Cross-workspace draft access denied." };
  }
  if (existing.createdByInstanceId && existing.createdByInstanceId !== session.instanceId) {
    return { ok: false, status: 403, code: "OWNERSHIP_DENIED", error: "Agents may only submit their own drafts." };
  }
  if (["APPROVED", "SKIPPED", "EXPIRED"].includes(existing.status)) {
    return { ok: false, status: 409, code: "INVALID_STATE", error: "Draft cannot be submitted in its current state." };
  }

  const next = {
    ...existing,
    status: "READY_FOR_REVIEW",
    approvalStatus: "PENDING",
    updatedAt: new Date().toISOString(),
  };
  await upsert(COLLECTIONS.content, next);
  await auditDraft(DRAFT_AUDIT.DRAFT_SUBMITTED, {
    workspaceId: session.workspaceId,
    draftId: next.id,
    actorType: "EXTERNAL_AGENT",
    actorId: session.id,
  });
  return { ok: true, status: 200, draft: await enrichDraft(next), providerAction: "none" };
}

/**
 * @param {string} draftId
 * @param {{ workspaceId?: string|null, operatorId?: string|null, action: string, notes?: string, scheduledFor?: string }} opts
 */
export async function operatorReviewDraft(draftId, {
  workspaceId = null,
  operatorId = null,
  action,
  notes = "",
  scheduledFor = undefined,
} = {}) {
  await initDb();
  const existing = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(existing)) return { ok: false, status: 404, error: "Draft not found." };
  if (workspaceId && existing.workspaceId !== workspaceId && existing.managedProfileId !== workspaceId) {
    return { ok: false, status: 403, error: "Cross-workspace review denied." };
  }

  const expired = maybeExpireDraftSync(existing);
  if (expired.status === "SKIPPED" && expired.approvalStatus === "EXPIRED") {
    await persistExpired(expired);
    return { ok: false, status: 409, code: "APPROVAL_EXPIRED", error: "Approval deadline passed. Draft was skipped — not rescheduled." };
  }

  if (action === "REQUEST_CHANGES") {
    const next = {
      ...existing,
      status: "CHANGES_REQUESTED",
      approvalStatus: "CHANGES_REQUESTED",
      operatorNotes: String(notes || "").slice(0, 2000),
      updatedAt: new Date().toISOString(),
    };
    await upsert(COLLECTIONS.content, next);
    await auditDraft(DRAFT_AUDIT.CHANGES_REQUESTED, {
      workspaceId: existing.workspaceId,
      draftId,
      actorType: "OPERATOR",
      actorId: operatorId,
    });
    return { ok: true, status: 200, draft: await enrichDraft(next), execution: "never_auto_published" };
  }

  if (action === "SKIP") {
    const next = {
      ...existing,
      status: "SKIPPED",
      approvalStatus: "SKIPPED",
      operatorNotes: String(notes || "").slice(0, 2000),
      updatedAt: new Date().toISOString(),
    };
    await upsert(COLLECTIONS.content, next);
    await auditDraft(DRAFT_AUDIT.DRAFT_SKIPPED, {
      workspaceId: existing.workspaceId,
      draftId,
      actorType: "OPERATOR",
      actorId: operatorId,
    });
    return { ok: true, status: 200, draft: await enrichDraft(next), execution: "never_auto_published" };
  }

  if (action !== "APPROVE") {
    return { ok: false, status: 400, error: "Action must be APPROVE, REQUEST_CHANGES, or SKIP." };
  }

  const schedule = scheduledFor !== undefined ? scheduledFor : existing.scheduledFor;
  const fingerprint = draftApprovalFingerprint({ ...existing, scheduledFor: schedule || existing.scheduledFor });
  const approval = {
    id: createApprovalId(),
    kind: APPROVAL_KIND,
    workspaceId: existing.workspaceId,
    managedProfileId: existing.workspaceId,
    draftId: existing.id,
    contentId: existing.id,
    contentFingerprint: fingerprint,
    caption: existing.caption || "",
    title: existing.title || "",
    description: existing.description || "",
    mediaRefs: [...(existing.mediaRefs || [])],
    destinationAccountId: existing.destinationAccountId || "",
    platform: existing.platform || "",
    scheduledFor: schedule || null,
    operatorId: operatorId || null,
    approvedAt: new Date().toISOString(),
    // Durable schedule-bound approval — NOT the 15-minute publish token TTL.
    expiresAt: null,
    status: "APPROVED",
    consumedAt: null,
  };
  await upsert(COLLECTIONS.approvals, approval);

  const next = {
    ...existing,
    status: "APPROVED",
    approvalStatus: "APPROVED",
    approvalId: approval.id,
    scheduledFor: schedule || existing.scheduledFor || null,
    operatorNotes: String(notes || existing.operatorNotes || "").slice(0, 2000),
    creativeApprovalState: "CREATIVE_APPROVED",
    updatedAt: new Date().toISOString(),
  };
  await upsert(COLLECTIONS.content, next);
  await auditDraft(DRAFT_AUDIT.DRAFT_APPROVED, {
    workspaceId: existing.workspaceId,
    draftId,
    actorType: "OPERATOR",
    actorId: operatorId,
    detail: { approvalId: approval.id, scheduledFor: next.scheduledFor },
  });

  let scheduledJob = null;
  if (next.scheduledFor && next.destinationAccountId) {
    const { ensureMarketingPublishJob } = await import("./scheduleBridge.js");
    scheduledJob = await ensureMarketingPublishJob(next.id);
    if (scheduledJob.ok && scheduledJob.draft) {
      Object.assign(next, scheduledJob.draft);
    }
  }

  const enriched = await enrichDraft(next);
  return {
    ok: true,
    status: 200,
    draft: enriched,
    approval: {
      id: approval.id,
      contentFingerprint: approval.contentFingerprint,
      scheduledFor: approval.scheduledFor,
      approvedAt: approval.approvedAt,
    },
    execution: scheduledJob?.ok ? "scheduled_for_provider_dispatch" : "approved_awaiting_schedule",
    publishJob: scheduledJob?.job || null,
    note: scheduledJob?.ok
      ? "Creative approved and queued for scheduled provider dispatch. No provider write until schedule time."
      : (enriched.publishReady
        ? "Creative approved. Assign a schedule to enqueue provider dispatch."
        : "Creative approved. Provider remains blocked — not publish-ready."),
  };
}

/**
 * @param {string} draftId
 * @param {{ workspaceId?: string|null, operatorId?: string|null, scheduledFor: string, approvalDeadline?: string|null, timezone?: string|null }} opts
 */
export async function assignDraftSchedule(draftId, {
  workspaceId = null,
  operatorId = null,
  scheduledFor,
  approvalDeadline = null,
  timezone = null,
} = {}) {
  await initDb();
  const existing = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(existing)) return { ok: false, status: 404, error: "Draft not found." };
  if (workspaceId && existing.workspaceId !== workspaceId) {
    return { ok: false, status: 403, error: "Cross-workspace schedule assignment denied." };
  }
  if (!scheduledFor) return { ok: false, status: 400, error: "scheduledFor is required." };

  const next = {
    ...existing,
    scheduledFor,
    approvalDeadline: approvalDeadline || existing.approvalDeadline,
    timezone: timezone || existing.timezone,
    scheduleAssignedBy: operatorId || null,
    scheduleAssignedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Changing schedule invalidates prior approval binding.
  if (existing.approvalStatus === "APPROVED" && existing.scheduledFor !== scheduledFor) {
    next.status = "READY_FOR_REVIEW";
    next.approvalStatus = "INVALIDATED";
    next.approvalId = null;
  }

  await upsert(COLLECTIONS.content, next);
  await auditDraft(DRAFT_AUDIT.SCHEDULE_ASSIGNED, {
    workspaceId: existing.workspaceId,
    draftId,
    actorType: "OPERATOR",
    actorId: operatorId,
    detail: { scheduledFor },
  });

  let publishJob = null;
  if (next.approvalStatus === "APPROVED" && next.destinationAccountId) {
    const { ensureMarketingPublishJob } = await import("./scheduleBridge.js");
    const bridged = await ensureMarketingPublishJob(next.id);
    if (bridged.ok) {
      publishJob = bridged.job;
      if (bridged.draft) Object.assign(next, bridged.draft);
    }
  }

  return {
    ok: true,
    status: 200,
    draft: await enrichDraft(next),
    publishJob,
  };
}

export async function assertApprovalStillValid(draftId) {
  await initDb();
  const draft = await get(COLLECTIONS.content, draftId);
  if (!isMarketingDraft(draft) || draft.approvalStatus !== "APPROVED" || !draft.approvalId) {
    return { ok: false, code: "NOT_APPROVED" };
  }
  const approval = await get(COLLECTIONS.approvals, draft.approvalId);
  if (!approval || approval.kind !== APPROVAL_KIND) return { ok: false, code: "APPROVAL_MISSING" };
  const current = draftApprovalFingerprint(draft);
  if (current !== approval.contentFingerprint) {
    return { ok: false, code: "APPROVAL_FINGERPRINT_MISMATCH" };
  }
  return { ok: true, approval };
}

export { BRIDGE_AUDIT };
