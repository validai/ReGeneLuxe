import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_DB_MODE = "memory";
process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com,lab@example.com";
process.env.RL_DISABLE_JOB_TICKER = "1";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, closeDb, upsert, COLLECTIONS, setMeta, getMeta } = await import("../db/index.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const { createManagedProfile } = await import("../db/managedProfileRepository.js");
const {
  emptyMarketingDraft,
  draftApprovalFingerprint,
  APPROVAL_KIND,
} = await import("./model.js");
const { prepareScheduledDispatch, DISPATCH_SKIP_REASONS, PUBLISHING_PAUSE_META_KEY, SCHEDULE_WINDOW_MS } = await import("./dispatchPipeline.js");
const { executeDryRunDispatch } = await import("./dryRunDispatch.js");
const { ensureMarketingPublishJob } = await import("./scheduleBridge.js");
const { claimNextJob, JOB_STATES, enqueueJob, JOB_TYPES } = await import("../db/jobs.js");
const { createApprovalId } = await import("./model.js");

describe("scheduled dispatch bridge", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    await resetDbForTests();
    await initDb();
    await setMeta(PUBLISHING_PAUSE_META_KEY, "0");
  });

  afterEach(async () => {
    await closeDb();
  });

  async function seedApprovedDraft({ scheduledFor = new Date(Date.now() + 60_000).toISOString() } = {}) {
    const op = await upsertOperatorFromGoogle({
      googleSub: "lab-dispatch",
      email: "lab@example.com",
    });
    const workspace = await createManagedProfile(op.id, {
      displayName: "ReGeneLuxe Test Lab",
      workspacePurpose: "TEST",
    });
    const account = {
      id: "acc_test_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_1",
      managedProfileId: workspace.id,
      handle: "@test_lab",
    };
    await upsert(COLLECTIONS.accounts, account);
    const draft = emptyMarketingDraft({
      workspaceId: workspace.id,
      managedProfileId: workspace.id,
      destinationAccountId: account.id,
      platform: "instagram",
      caption: "TEST — certification caption",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      scheduledFor,
      releaseGateState: "READY",
      releaseGates: [],
      mediaRefs: ["med_test"],
      heroAssetId: "med_test",
    });
    const fingerprint = draftApprovalFingerprint(draft);
    const approval = {
      id: createApprovalId(),
      kind: APPROVAL_KIND,
      draftId: draft.id,
      workspaceId: workspace.id,
      contentFingerprint: fingerprint,
      scheduledFor,
      approvedAt: new Date().toISOString(),
      expiresAt: null,
    };
    draft.approvalId = approval.id;
    await upsert(COLLECTIONS.approvals, approval);
    await upsert(COLLECTIONS.content, draft);
    return { workspace, account, draft, approval };
  }

  it("dry and real share eligibility and dry-run never writes", async () => {
    const { draft, account } = await seedApprovedDraft();
    const dry = await executeDryRunDispatch(draft, { account });
    expect(dry.DRY_RUN).toBe(true);
    expect(dry.providerWrite).toBe(false);

    const prepared = await prepareScheduledDispatch(draft, account, { dryRun: false });
    // Without public media / tokens, provider readiness blocks real write.
    expect(prepared.providerWrite === false || prepared.ok === false).toBe(true);
  });

  it("pause switch blocks new scheduled writes", async () => {
    const { draft, account } = await seedApprovedDraft();
    await setMeta(PUBLISHING_PAUSE_META_KEY, "1");
    expect(await getMeta(PUBLISHING_PAUSE_META_KEY)).toBe("1");
    const prepared = await prepareScheduledDispatch(draft, account, { dryRun: false });
    expect(prepared.reasons).toContain(DISPATCH_SKIP_REASONS.PAUSED);
    expect(prepared.ok).toBe(false);
  });

  it("missed schedule window skips without late send", async () => {
    const past = new Date(Date.now() - SCHEDULE_WINDOW_MS - 60_000).toISOString();
    const { draft, account } = await seedApprovedDraft({ scheduledFor: past });
    // Keep approval fingerprint in sync after scheduledFor change
    draft.scheduledFor = past;
    const fingerprint = draftApprovalFingerprint(draft);
    await upsert(COLLECTIONS.approvals, {
      ...(await (await import("../db/index.js")).get(COLLECTIONS.approvals, draft.approvalId)),
      contentFingerprint: fingerprint,
      scheduledFor: past,
    });
    await upsert(COLLECTIONS.content, draft);
    const prepared = await prepareScheduledDispatch(draft, account, {
      dryRun: false,
      now: Date.now(),
    });
    expect(prepared.reasons).toContain(DISPATCH_SKIP_REASONS.SCHEDULE_WINDOW_MISSED);
  });

  it("bridges approved scheduled drafts into PUBLISH_CONTENT jobs", async () => {
    const { draft } = await seedApprovedDraft();
    const bridged = await ensureMarketingPublishJob(draft.id);
    expect(bridged.ok).toBe(true);
    expect(bridged.job.type).toBe("PUBLISH_CONTENT");
    expect(bridged.job.payload.marketingAuthority).toBe(true);
    expect(bridged.draft.dispatchState).toBe("SCHEDULED");
  });

  it("reclaims expired RUNNING leases after crash", async () => {
    const pastLease = new Date(Date.now() - 60_000).toISOString();
    const job = await enqueueJob({
      type: JOB_TYPES.SYNC_REMOTE,
      payload: { pull: false },
      scheduledAt: new Date(Date.now() - 1_000).toISOString(),
    });
    const { getLocalClient } = await import("../db/client.js");
    const db = getLocalClient();
    await db.execute({
      sql: `UPDATE jobs SET state = ?, lease_owner = ?, lease_until = ?, started_at = ? WHERE id = ?`,
      args: [JOB_STATES.RUNNING, "dead_worker", pastLease, pastLease, job.id],
    });
    const claimed = await claimNextJob("recovery_worker");
    expect(claimed.id).toBe(job.id);
    expect(claimed.leaseOwner).toBe("recovery_worker");
  });

  it("invalidated approval fingerprint blocks dispatch", async () => {
    const { draft, account } = await seedApprovedDraft();
    const prepared = await prepareScheduledDispatch(
      { ...draft, caption: "CHANGED AFTER APPROVAL" },
      account,
      { dryRun: false, expectedFingerprint: "stale_fp" },
    );
    expect(prepared.reasons).toContain(DISPATCH_SKIP_REASONS.FINGERPRINT_MISMATCH);
  });
});
