import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_DB_MODE = "memory";
process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com,lab@example.com";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, closeDb, upsert, list, COLLECTIONS } = await import("../db/index.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const { createManagedProfile, listProfilesForOperator } = await import("../db/managedProfileRepository.js");
const { listForProfile } = await import("../db/profileMigration.js");
const { buildConnectionCertificationMatrix } = await import("./connectionMatrix.js");
const { executeDryRunDispatch } = await import("../marketingDrafts/dryRunDispatch.js");
const { emptyMarketingDraft, scheduledPublishEligibility } = await import("../marketingDrafts/model.js");
const {
  ROLE_DEFAULT_CAPABILITIES,
  roleAllowsCapability,
  AGENT_ROLES,
} = await import("../externalAgent/roles.js");

describe("isolated test profile + connection certification", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com,lab@example.com";
    await resetDbForTests();
    await initDb();
  });

  afterEach(async () => {
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com";
    await closeDb();
  });

  it("creates a second Google identity TEST workspace that starts clean", async () => {
    const coast = await upsertOperatorFromGoogle({
      googleSub: "coast-sub",
      email: "djcoast239@gmail.com",
    });
    const lab = await upsertOperatorFromGoogle({
      googleSub: "lab-sub",
      email: "lab@example.com",
    });
    const production = await createManagedProfile(coast.id, {
      displayName: "DJ Coast",
      workspacePurpose: "PRODUCTION",
    });
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_coast",
      name: "Teotihuacan",
      managedProfileId: production.id,
    });
    await upsert(COLLECTIONS.accounts, {
      id: "acc_coast_ig",
      platform: "Instagram",
      handle: "@_djcoast",
      connectionState: "CONNECTED",
      managedProfileId: production.id,
    });
    await upsert(COLLECTIONS.content, {
      id: "cnt_coast",
      title: "Coast post",
      managedProfileId: production.id,
    });

    const testLab = await createManagedProfile(lab.id, {
      displayName: "ReGeneLuxe Test Lab",
      workspacePurpose: "TEST",
      primaryEmail: "lab@example.com",
    });

    expect(testLab.workspacePurpose).toBe("TEST");
    expect(testLab.id).not.toBe(production.id);
    expect(await listProfilesForOperator(lab.id)).toHaveLength(1);
    expect(await listForProfile(COLLECTIONS.campaigns, testLab.id)).toEqual([]);
    expect(await listForProfile(COLLECTIONS.accounts, testLab.id)).toEqual([]);
    expect(await listForProfile(COLLECTIONS.content, testLab.id)).toEqual([]);
    expect((await listForProfile(COLLECTIONS.campaigns, production.id)).map((r) => r.id)).toEqual(["camp_coast"]);
  });

  it("does not attach legacy unscoped rows to a later TEST profile", async () => {
    const coast = await upsertOperatorFromGoogle({
      googleSub: "coast-first",
      email: "djcoast239@gmail.com",
    });
    await upsert(COLLECTIONS.campaigns, { id: "legacy_camp", name: "Legacy" });
    const production = await createManagedProfile(coast.id, { displayName: "DJ Coast" });
    expect((await listForProfile(COLLECTIONS.campaigns, production.id)).map((r) => r.id)).toContain("legacy_camp");

    const lab = await upsertOperatorFromGoogle({
      googleSub: "lab-second",
      email: "lab@example.com",
    });
    const testLab = await createManagedProfile(lab.id, {
      displayName: "ReGeneLuxe Test Lab",
      workspacePurpose: "TEST",
    });
    expect(await listForProfile(COLLECTIONS.campaigns, testLab.id)).toEqual([]);
  });

  it("duplicate create is idempotent for the same account", async () => {
    const lab = await upsertOperatorFromGoogle({
      googleSub: "lab-dup",
      email: "lab@example.com",
    });
    const first = await createManagedProfile(lab.id, {
      displayName: "ReGeneLuxe Test Lab",
      workspacePurpose: "TEST",
    });
    const second = await createManagedProfile(lab.id, {
      displayName: "Another Name",
      workspacePurpose: "TEST",
    });
    expect(second.id).toBe(first.id);
    expect(await list(COLLECTIONS.managed_profiles)).toHaveLength(1);
  });

  it("keeps provider certification honest (no GREEN without controlled real test)", async () => {
    const lab = await upsertOperatorFromGoogle({
      googleSub: "lab-cert",
      email: "lab@example.com",
    });
    const workspace = await createManagedProfile(lab.id, {
      displayName: "ReGeneLuxe Test Lab",
      workspacePurpose: "TEST",
    });
    const accounts = [{
      id: "acc_test_ig",
      platform: "Instagram",
      handle: "@test_lab_ig",
      externalAccountId: "ig_123",
      connectionState: "CONNECTED",
      managedProfileId: workspace.id,
    }];
    const matrix = buildConnectionCertificationMatrix({ workspace, accounts });
    const instagram = matrix.providers.find((row) => row.provider === "instagram");
    expect(instagram.connected).toBe(true);
    expect(instagram.status).not.toBe("GREEN");
    expect(instagram.blockers).toContain("CONTROLLED_REAL_TEST_PENDING");
    expect(matrix.system.status).not.toBe("GREEN");
  });

  it("separates MR POST draft capabilities from MR ENTREPRENEUR", () => {
    expect(roleAllowsCapability(AGENT_ROLES.CONTENT_OPERATOR, "CREATE_CONTENT_DRAFT")).toBe(true);
    expect(roleAllowsCapability(AGENT_ROLES.CAMPAIGN_STRATEGIST, "CREATE_CONTENT_DRAFT")).toBe(false);
    expect(ROLE_DEFAULT_CAPABILITIES.CAMPAIGN_STRATEGIST).not.toContain("CREATE_CONTENT_DRAFT");
    expect(ROLE_DEFAULT_CAPABILITIES.CONTENT_OPERATOR).toContain("SUBMIT_CONTENT_FOR_APPROVAL");
  });

  it("certifies schedule eligibility positives and negatives", () => {
    const ready = emptyMarketingDraft({
      status: "APPROVED",
      approvalStatus: "APPROVED",
      scheduledFor: "2026-12-01T12:00:00.000Z",
      releaseGateState: "READY",
      releaseGates: [{ type: "ALBUM_VERIFIED_LIVE", state: "READY" }],
    });
    expect(scheduledPublishEligibility(ready, { providerReady: true }).ELIGIBLE_FOR_SCHEDULED_PUBLISH).toBe(true);
    expect(scheduledPublishEligibility(ready, { providerReady: false }).ELIGIBLE_FOR_SCHEDULED_PUBLISH).toBe(false);
    expect(scheduledPublishEligibility({
      ...ready,
      scheduledFor: "",
    }, { providerReady: true }).ELIGIBLE_FOR_SCHEDULED_PUBLISH).toBe(false);
  });

  it("dry-run dispatch never writes providers and suppresses duplicates", () => {
    const draft = emptyMarketingDraft({
      id: "mdraft_test",
      status: "APPROVED",
      approvalStatus: "APPROVED",
      scheduledFor: "2026-12-01T12:00:00.000Z",
      releaseGateState: "READY",
      platform: "instagram",
      destinationAccountId: "acc_test",
      caption: "TEST — Instagram connection certification",
    });
    const first = executeDryRunDispatch(draft, { providerReady: true });
    expect(first.DRY_RUN).toBe(true);
    expect(first.providerWrite).toBe(false);
    expect(first.ok).toBe(true);
    expect(first.simulatedProviderResult.status).toBe("SIMULATED_SUCCESS");

    const duplicate = executeDryRunDispatch(draft, {
      providerReady: true,
      priorDispatchKeys: [first.duplicateKey],
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.blockedReasons).toContain("DUPLICATE_SUPPRESSED");
  });

  it("blocks dry-run when release gates are not ready", () => {
    const draft = emptyMarketingDraft({
      status: "APPROVED",
      approvalStatus: "APPROVED",
      scheduledFor: "2026-12-01T12:00:00.000Z",
      releaseGateState: "BLOCKED",
      releaseGates: [{ type: "ALBUM_VERIFIED_LIVE", state: "BLOCKED" }],
    });
    const result = executeDryRunDispatch(draft, { providerReady: true });
    expect(result.ok).toBe(false);
    expect(result.eligibility.RELEASE_GATES_READY).toBe(false);
  });
});
