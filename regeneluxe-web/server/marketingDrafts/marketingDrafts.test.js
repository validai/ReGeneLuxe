import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-mdraft-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-mdraft-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
process.env.EXTERNAL_AGENT_BRIDGE_ENABLED = "1";

const { initDb, resetDbForTests, upsert, get, list, COLLECTIONS } = await import("../db/index.js");
const {
  beginHandshake,
  denyControlAttempt,
  startOperatorPairing,
  submitProposal,
  agentCreateDraft,
  agentUpdateDraft,
  agentSubmitDraft,
  agentReadDraft,
} = await import("../externalAgent/bridge.js");
const { ALLOWED_CAPABILITIES, DENIED_ACTIONS, isDeniedAction, validateRequestedCapabilities } = await import("../externalAgent/capabilities.js");
const { SESSION_TTL_MS } = await import("../externalAgent/store.js");
const { normalizeAgentRole } = await import("../externalAgent/roles.js");
const {
  operatorReviewDraft,
  assignDraftSchedule,
  assertApprovalStillValid,
  getMarketingDraft,
} = await import("./service.js");
const { draftApprovalFingerprint, detectOutNowCopy, scheduledPublishEligibility } = await import("./model.js");
const { readSecrets } = await import("../secrets.js");

const WORKSPACE = "prf_mdraft_ws";
const DRAFT_CAPS = [
  "READ_PRODUCT_CONTEXT",
  "READ_WORKSPACE_SUMMARY",
  "READ_ACCOUNT_METADATA",
  "READ_CAMPAIGN_SUMMARY",
  "READ_CONTENT_METADATA",
  "CREATE_CONTENT_DRAFT",
  "UPDATE_OWN_CONTENT_DRAFT",
  "SUBMIT_CONTENT_FOR_APPROVAL",
  "READ_APPROVAL_STATUS",
  "READ_SCHEDULE_ASSIGNMENT",
  "SUBMIT_PROPOSAL",
];

function request(headers = {}) {
  return new Request("http://127.0.0.1:5174/api/external-agent/handshake", {
    method: "POST",
    headers: {
      host: "127.0.0.1:5174",
      origin: "http://localhost:5174",
      ...headers,
    },
  });
}

async function openContentOperator(instanceId = "good-post-reviews-1") {
  const pairing = startOperatorPairing({
    operatorId: "op_1",
    workspaceId: WORKSPACE,
    workspaceName: "DJ Coast",
  });
  return beginHandshake(request(), {
    agentType: "grokbot",
    displayName: "Good Post Reviews",
    instanceId,
    agentRole: "CONTENT_OPERATOR",
    protocolVersion: "1",
    requestedCapabilities: DRAFT_CAPS,
    pairingCredential: pairing.pairingCredential,
  });
}

async function openStrategist() {
  const pairing = startOperatorPairing({
    operatorId: "op_1",
    workspaceId: WORKSPACE,
    workspaceName: "DJ Coast",
  });
  return beginHandshake(request(), {
    agentType: "grokbot",
    displayName: "MR ENTREPRENEUR",
    instanceId: "mr-entrepreneur-1",
    agentRole: "CAMPAIGN_STRATEGIST",
    protocolVersion: "1",
    requestedCapabilities: [
      "READ_PRODUCT_CONTEXT",
      "SUBMIT_PROPOSAL",
      "CREATE_CONTENT_DRAFT",
    ],
    pairingCredential: pairing.pairingCredential,
  });
}

describe("Marketing draft approval workflow", () => {
  beforeEach(async () => {
    process.env.EXTERNAL_AGENT_BRIDGE_ENABLED = "1";
    await resetDbForTests();
    await initDb();
    await upsert(COLLECTIONS.accounts, {
      id: "acc_ig",
      platform: "Instagram",
      handle: "@_djcoast",
      displayName: "_djcoast",
      connectionState: "CONNECTED",
      publishPermission: "APPROVAL_REQUIRED",
      managedProfileId: WORKSPACE,
    });
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_teo",
      name: "Teotihuacan",
      managedProfileId: WORKSPACE,
      assets: [{ id: "asset_123", name: "approved-artwork-crop-001", contentType: "feed image", status: "READY" }],
    });
  });

  afterEach(() => {
    delete process.env.EXTERNAL_AGENT_BRIDGE_ENABLED;
  });

  it("keeps the 15-minute agent session TTL unchanged", () => {
    expect(SESSION_TTL_MS).toBe(15 * 60 * 1000);
  });

  it("adds draft capabilities without wildcards and still denies publish", () => {
    expect(ALLOWED_CAPABILITIES).toEqual(expect.arrayContaining([
      "CREATE_CONTENT_DRAFT",
      "UPDATE_OWN_CONTENT_DRAFT",
      "SUBMIT_CONTENT_FOR_APPROVAL",
      "READ_APPROVAL_STATUS",
      "READ_SCHEDULE_ASSIGNMENT",
    ]));
    expect(validateRequestedCapabilities(["CREATE_CONTENT_DRAFT", "PUBLISH"]).ok).toBe(false);
    expect(isDeniedAction("PUBLISH")).toBe(true);
    expect(isDeniedAction("PUBLISH_APPROVED_CONTENT")).toBe(true);
    expect(isDeniedAction("SCHEDULE_DIRECTLY")).toBe(true);
    expect(isDeniedAction("APPROVE_CONTENT")).toBe(true);
    expect(isDeniedAction("BYPASS_APPROVAL")).toBe(true);
    expect(DENIED_ACTIONS).toContain("WRITE_PROVIDER");
  });

  it("enforces role intent so strategists cannot claim draft-write capabilities", async () => {
    expect(normalizeAgentRole("", { displayName: "Good Post Reviews" })).toBe("CONTENT_OPERATOR");
    expect(normalizeAgentRole("", { displayName: "MR ENTREPRENEUR" })).toBe("CAMPAIGN_STRATEGIST");
    const denied = await openStrategist();
    expect(denied.ok).toBe(false);
    expect(denied.code).toBe("ROLE_CAPABILITY_DENIED");
  });

  it("lets a content operator create, update own draft, submit, and denies publish/approve/account mutation", async () => {
    const opened = await openContentOperator();
    expect(opened.ok).toBe(true);
    expect(opened.session.agentRole).toBe("CONTENT_OPERATOR");
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });

    const created = await agentCreateDraft(authed, {
      campaignId: "camp_teo",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
      contentType: "feed image",
      title: "Teotihuacan drop",
      caption: "New music soon.",
      mediaRefs: ["asset_123"],
      requestedScheduledFor: "2026-11-18T19:00:00-05:00",
      requiresAlbumLive: false,
    });
    expect(created.ok).toBe(true);
    expect(created.draft.status).toBe("DRAFT");
    expect(created.draft.scheduledFor).toBeNull();
    expect(created.draft.requestedScheduledFor).toContain("2026-11-18");

    const updated = await agentUpdateDraft(authed, created.draft.id, {
      caption: "Teotihuacan visuals.",
    });
    expect(updated.ok).toBe(true);
    expect(updated.draft.caption).toBe("Teotihuacan visuals.");

    const other = await openContentOperator("other-agent");
    const otherAuthed = request({ "x-regeneluxe-agent-session": other.sessionToken });
    // Re-open original creator after one-session-per-workspace revoke
    const again = await openContentOperator("good-post-reviews-1");
    const owner = request({ "x-regeneluxe-agent-session": again.sessionToken });
    const foreign = await agentUpdateDraft(otherAuthed, created.draft.id, { caption: "hijack" });
    // other session may fail due to workspace single-session revoke; recreate foreign agent after owner
    const foreignPair = startOperatorPairing({ operatorId: "op_1", workspaceId: WORKSPACE, workspaceName: "DJ Coast" });
    // Actually startOperatorPairing then handshake as other while owner holds session - handshake revokes owner.
    const foreignOpen = beginHandshake(request(), {
      agentType: "grokbot",
      displayName: "Other Bot",
      instanceId: "other-agent-2",
      agentRole: "CONTENT_OPERATOR",
      protocolVersion: "1",
      requestedCapabilities: DRAFT_CAPS,
      pairingCredential: foreignPair.pairingCredential,
    });
    const foreignAuthed = request({ "x-regeneluxe-agent-session": foreignOpen.sessionToken });
    const deniedUpdate = await agentUpdateDraft(foreignAuthed, created.draft.id, { caption: "hijack" });
    expect(deniedUpdate.ok).toBe(false);
    expect(deniedUpdate.code).toBe("OWNERSHIP_DENIED");

    // Restore owner session
    const restorePair = startOperatorPairing({ operatorId: "op_1", workspaceId: WORKSPACE, workspaceName: "DJ Coast" });
    const restore = beginHandshake(request(), {
      agentType: "grokbot",
      displayName: "Good Post Reviews",
      instanceId: "good-post-reviews-1",
      agentRole: "CONTENT_OPERATOR",
      protocolVersion: "1",
      requestedCapabilities: DRAFT_CAPS,
      pairingCredential: restorePair.pairingCredential,
    });
    const owner2 = request({ "x-regeneluxe-agent-session": restore.sessionToken });

    const submitted = await agentSubmitDraft(owner2, created.draft.id);
    expect(submitted.ok).toBe(true);
    expect(submitted.draft.status).toBe("READY_FOR_REVIEW");
    expect(submitted.providerAction).toBe("none");

    expect((await agentCreateDraft(owner2, { action: "PUBLISH", title: "x", caption: "y" })).ok).toBe(false);
    expect(denyControlAttempt(owner2, "PUBLISH").ok).toBe(false);

    const noCap = await agentCreateDraft(request({ "x-regeneluxe-agent-session": "eas_tok_missing" }), {
      title: "nope",
      caption: "nope",
    });
    expect(noCap.ok).toBe(false);

    const accountMutate = await agentUpdateDraft(owner2, created.draft.id, {
      destinationAccountId: "acc_other_ws",
    });
    // destination outside workspace
    await upsert(COLLECTIONS.accounts, {
      id: "acc_other_ws",
      platform: "Instagram",
      managedProfileId: "prf_other",
      connectionState: "CONNECTED",
    });
    const accountMutate2 = await agentUpdateDraft(owner2, created.draft.id, {
      destinationAccountId: "acc_other_ws",
    });
    expect(accountMutate2.ok).toBe(false);
    expect(accountMutate2.code).toBe("ACCOUNT_DENIED");

    const pathDenied = await agentUpdateDraft(owner2, created.draft.id, {
      mediaRefs: ["/Users/eric/Desktop/secret.png"],
    });
    expect(pathDenied.ok).toBe(false);
    expect(pathDenied.code).toBe("FILESYSTEM_PATH_DENIED");

    void foreign;
    void owner;
    void accountMutate;
  });

  it("supports operator approve / changes / skip with fingerprint binding and no auto publish", async () => {
    const opened = await openContentOperator();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const created = await agentCreateDraft(authed, {
      campaignId: "camp_teo",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
      title: "Storm Sessions",
      caption: "Countdown.",
      mediaRefs: ["asset_123"],
    });
    await agentSubmitDraft(authed, created.draft.id);

    const changes = await operatorReviewDraft(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      action: "REQUEST_CHANGES",
      notes: "Tighten CTA",
    });
    expect(changes.draft.status).toBe("CHANGES_REQUESTED");

    const pair = startOperatorPairing({ operatorId: "op_1", workspaceId: WORKSPACE, workspaceName: "DJ Coast" });
    const reopen = beginHandshake(request(), {
      agentType: "grokbot",
      displayName: "Good Post Reviews",
      instanceId: "good-post-reviews-1",
      agentRole: "CONTENT_OPERATOR",
      protocolVersion: "1",
      requestedCapabilities: DRAFT_CAPS,
      pairingCredential: pair.pairingCredential,
    });
    const owner = request({ "x-regeneluxe-agent-session": reopen.sessionToken });
    await agentUpdateDraft(owner, created.draft.id, { caption: "Countdown. Link in bio." });
    await agentSubmitDraft(owner, created.draft.id);

    await assignDraftSchedule(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      scheduledFor: "2026-11-20T19:00:00-05:00",
      approvalDeadline: "2026-11-20T17:00:00-05:00",
    });

    const approved = await operatorReviewDraft(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      action: "APPROVE",
    });
    expect(approved.ok).toBe(true);
    expect(approved.execution).toBe("never_auto_published");
    expect(approved.draft.status).toBe("APPROVED");
    expect(approved.draft.scheduledFor).toContain("2026-11-20");
    expect(approved.approval.contentFingerprint).toBe(draftApprovalFingerprint(approved.draft));

    const stillValid = await assertApprovalStillValid(created.draft.id);
    expect(stillValid.ok).toBe(true);

    // Caption change invalidates
    const row = await get(COLLECTIONS.content, created.draft.id);
    await upsert(COLLECTIONS.content, { ...row, caption: "Changed after approval", updatedAt: new Date().toISOString() });
    const invalid = await assertApprovalStillValid(created.draft.id);
    expect(invalid.ok).toBe(false);
    expect(invalid.code).toBe("APPROVAL_FINGERPRINT_MISMATCH");

    // Proposals still work
    const proposal = submitProposal(owner, {
      title: "Rollout note",
      recommendation: "Keep Friday slot",
    });
    expect(proposal.ok).toBe(true);

    // Skip path
    const created2 = await agentCreateDraft(owner, {
      title: "Skip me",
      caption: "x",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
    });
    await agentSubmitDraft(owner, created2.draft.id);
    const skipped = await operatorReviewDraft(created2.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      action: "SKIP",
    });
    expect(skipped.draft.status).toBe("SKIPPED");
  });

  it("expires by approval deadline without rescheduling", async () => {
    const opened = await openContentOperator();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const created = await agentCreateDraft(authed, {
      title: "Late window",
      caption: "x",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
      approvalDeadline: new Date(Date.now() - 60_000).toISOString(),
    });
    await agentSubmitDraft(authed, created.draft.id);
    const reviewed = await operatorReviewDraft(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      action: "APPROVE",
    });
    expect(reviewed.ok).toBe(false);
    expect(reviewed.code).toBe("APPROVAL_EXPIRED");
    const draft = await getMarketingDraft(created.draft.id, { workspaceId: WORKSPACE });
    expect(draft.status).toBe("SKIPPED");
    expect(draft.scheduledFor).toBeNull();
  });

  it("flags out-now copy when release gates are missing and reports eligibility contract", async () => {
    expect(detectOutNowCopy("Album is out now")).toBe(true);
    const opened = await openContentOperator();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const created = await agentCreateDraft(authed, {
      title: "Teotihuacan is out now",
      caption: "Listen now",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
      requiresAlbumLive: true,
      requiresSmartLink: true,
    });
    expect(created.draft.outNowGuard.flagged).toBe(true);
    expect(created.draft.outNowGuard.blocking).toBe(true);

    const readyGates = {
      ...created.draft,
      releaseGates: [
        { type: "ALBUM_VERIFIED_LIVE", state: "READY" },
        { type: "SMART_LINK_TESTED", state: "READY" },
      ],
      releaseGateState: "READY",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      scheduledFor: "2026-11-24T12:00:00-05:00",
    };
    const eligibility = scheduledPublishEligibility(readyGates, { providerReady: false });
    expect(eligibility.CREATIVE_APPROVED).toBe(true);
    expect(eligibility.SCHEDULE_ASSIGNED).toBe(true);
    expect(eligibility.PROVIDER_READY).toBe(false);
    expect(eligibility.ELIGIBLE_FOR_SCHEDULED_PUBLISH).toBe(false);

    const status = await agentReadDraft(authed, created.draft.id);
    expect(status.ok).toBe(true);
    expect(status.draft.approvalStatus).toBeDefined();

    const audit = readSecrets().externalAgent.audit.map((row) => row.action);
    expect(audit).toEqual(expect.arrayContaining(["DRAFT_CREATED"]));

    // workspace isolation: foreign campaign denied
    await upsert(COLLECTIONS.campaigns, { id: "camp_x", name: "X", managedProfileId: "other" });
    const cross = await agentCreateDraft(authed, {
      campaignId: "camp_x",
      title: "no",
      caption: "no",
    });
    expect(cross.ok).toBe(false);
    expect(cross.code).toBe("CAMPAIGN_DENIED");

    expect((await list(COLLECTIONS.publications)).length).toBe(0);
  });

  it("surfaces creative-approved / provider-blocked distinctly", async () => {
    const opened = await openContentOperator();
    const authed = request({ "x-regeneluxe-agent-session": opened.sessionToken });
    const created = await agentCreateDraft(authed, {
      title: "Ready creative",
      caption: "Caption",
      platform: "Instagram",
      destinationAccountId: "acc_ig",
      mediaRefs: ["asset_123"],
    });
    await agentSubmitDraft(authed, created.draft.id);
    await assignDraftSchedule(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      scheduledFor: "2026-11-24T19:00:00-05:00",
    });
    const approved = await operatorReviewDraft(created.draft.id, {
      workspaceId: WORKSPACE,
      operatorId: "op_1",
      action: "APPROVE",
    });
    expect(approved.draft.creativeApprovalState).toBe("CREATIVE_APPROVED");
    expect(approved.draft.providerState).toBe("PROVIDER_BLOCKED");
    expect(approved.draft.publishReady).toBe(false);
  });
});
