import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_DB_MODE = "memory";
process.env.APP_ALLOWED_GOOGLE_EMAILS = "validsstudio@gmail.com";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, closeDb, list, get, upsert, COLLECTIONS } = await import("../db/index.js");
const { authorizeGoogleSignIn } = await import("./authorizeGoogle.js");
const { upsertOperatorFromGoogle, findOperatorByGoogleSub } = await import("../db/operatorRepository.js");
const {
  createManagedProfile,
  listProfilesForOperator,
  updateManagedProfile,
  setActiveProfileForOperator,
} = await import("../db/managedProfileRepository.js");
const { listForProfile } = await import("../db/profileMigration.js");
const { publicOperator, resolveActiveProfile, emptyManagedProfile } = await import("../../src/data/profileModels.js");
const { listPending } = await import("../db/outbox.js");

describe("operator + managed profile persistence", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    await resetDbForTests();
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it("upserts Operator by googleSub and does not duplicate", async () => {
    const first = await upsertOperatorFromGoogle({
      googleSub: "google-sub-1",
      email: "validsstudio@gmail.com",
      emailVerified: true,
      name: "Operator",
      avatarUrl: "https://example.com/a.png",
    });
    const second = await upsertOperatorFromGoogle({
      googleSub: "google-sub-1",
      email: "validsstudio@gmail.com",
      name: "Operator Updated",
    });
    expect(second.id).toBe(first.id);
    expect(second.name).toBe("Operator Updated");
    expect(await list(COLLECTIONS.operators)).toHaveLength(1);
    const found = await findOperatorByGoogleSub("google-sub-1");
    expect(found.id).toBe(first.id);
  });

  it("keeps googleSub as identity when email attribute changes", async () => {
    const created = await upsertOperatorFromGoogle({
      googleSub: "sub-stable",
      email: "old@example.com",
      name: "Op",
    });
    const updated = await upsertOperatorFromGoogle({
      googleSub: "sub-stable",
      email: "validsstudio@gmail.com",
      name: "Op",
    });
    expect(updated.id).toBe(created.id);
    expect(updated.email).toBe("validsstudio@gmail.com");
    expect(updated.googleSub).toBe("sub-stable");
  });

  it("approves allowlisted email even when optional Google profile fields are missing", async () => {
    const approved = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub-minimal" },
      profile: { sub: "sub-minimal", email: "validsstudio@gmail.com" },
    });
    expect(approved.ok).toBe(true);
    expect(approved.operator.googleSub).toBe("sub-minimal");
    expect(approved.operator.name).toBe("");
    expect(approved.operator.avatarUrl).toBe("");
  });

  it("still creates a local Operator when Turso is unavailable", async () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    const approved = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub-offline" },
      profile: { sub: "sub-offline", email: "validsstudio@gmail.com", name: "Valid" },
    });
    expect(approved.ok).toBe(true);
    expect(await findOperatorByGoogleSub("sub-offline")).toBeTruthy();
    const pending = await listPending();
    expect(pending.some((item) => item.collection === COLLECTIONS.operators)).toBe(true);
  });

  it("creates a ManagedProfile with nullable website and independent primaryPublicUrl", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-p",
      email: "validsstudio@gmail.com",
      name: "Valid",
    });
    const profile = await createManagedProfile(operator.id, {
      displayName: "DJ Coast",
      slug: "dj-coast",
      primaryEmail: "djcoast239@gmail.com",
      website: "",
      primaryPublicUrl: "https://www.youtube.com/@CoastEntertainment",
      timezone: "America/New_York",
      shortDescription: "Pilot profile",
      platforms: ["YouTube", "Instagram"],
    });
    expect(profile.website).toBeNull();
    expect(profile.primaryPublicUrl).toContain("youtube.com");
    expect(profile.ownerOperatorId).toBe(operator.id);
    expect(profile.slug).toBe("dj-coast");
    expect(profile.status).toBe("ACTIVE");
    expect(operator.id === profile.id).toBe(false);
  });

  it("does not duplicate a profile on repeated operator resolution", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-repeat",
      email: "validsstudio@gmail.com",
    });
    await createManagedProfile(operator.id, { displayName: "DJ Coast", slug: "dj-coast" });
    await upsertOperatorFromGoogle({
      googleSub: "sub-repeat",
      email: "validsstudio@gmail.com",
    });
    expect(await listProfilesForOperator(operator.id)).toHaveLength(1);
  });

  it("sets activeProfileId automatically for the first profile and never equal to operator id", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-active",
      email: "validsstudio@gmail.com",
    });
    const profile = await createManagedProfile(operator.id, { displayName: "DJ Coast" });
    const saved = await get(COLLECTIONS.operators, operator.id);
    expect(saved.activeProfileId).toBe(profile.id);
    expect(saved.activeProfileId).not.toBe(saved.id);
    await expect(setActiveProfileForOperator(operator.id, operator.id)).rejects.toThrow(/must not equal operator ID/);
  });

  it("scopes repository reads to the owning profile", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-scope",
      email: "validsstudio@gmail.com",
    });
    const one = await createManagedProfile(operator.id, { displayName: "DJ Coast", slug: "dj-coast" });
    const two = await createManagedProfile(operator.id, { displayName: "Future Brand", slug: "future-brand" });
    await upsert(COLLECTIONS.campaigns, { id: "camp-a", name: "Coast campaign", managedProfileId: one.id });
    await upsert(COLLECTIONS.campaigns, { id: "camp-b", name: "Other campaign", managedProfileId: two.id });
    const scoped = await listForProfile(COLLECTIONS.campaigns, one.id);
    expect(scoped.map((row) => row.id)).toEqual(["camp-a"]);
    expect(await listProfilesForOperator(operator.id)).toHaveLength(2);
    const resolved = resolveActiveProfile({ ...operator, activeProfileId: two.id }, [one, two]);
    expect(resolved.id).toBe(two.id);
  });

  it("attaches unscoped operator records to the first profile and skips fixtures", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-mig",
      email: "validsstudio@gmail.com",
    });
    await upsert(COLLECTIONS.campaigns, { id: "real_camp", name: "Real work" });
    await upsert(COLLECTIONS.accounts, { id: "real_acc", handle: "@real" });
    await upsert(COLLECTIONS.content, { id: "test_skip", title: "Fixture", provenance: "TEST" });
    await upsert(COLLECTIONS.content, { id: "fixture_row", title: "Also fixture", fixture: true });
    const profile = await createManagedProfile(operator.id, { displayName: "DJ Coast" });
    const campaign = await get(COLLECTIONS.campaigns, "real_camp");
    const account = await get(COLLECTIONS.accounts, "real_acc");
    const skipped = await get(COLLECTIONS.content, "test_skip");
    const fixture = await get(COLLECTIONS.content, "fixture_row");
    expect(campaign.managedProfileId).toBe(profile.id);
    expect(account.managedProfileId).toBe(profile.id);
    expect(skipped.managedProfileId).toBeFalsy();
    expect(fixture.managedProfileId).toBeFalsy();
  });

  it("sign-out does not delete operator, profile, or campaign data", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-out",
      email: "validsstudio@gmail.com",
    });
    const profile = await createManagedProfile(operator.id, { displayName: "DJ Coast" });
    await upsert(COLLECTIONS.campaigns, { id: "keep_me", name: "Keep", managedProfileId: profile.id });
    expect(await list(COLLECTIONS.operators)).toHaveLength(1);
    expect(await list(COLLECTIONS.managed_profiles)).toHaveLength(1);
    expect(await list(COLLECTIONS.campaigns)).toHaveLength(1);
  });

  it("sign-back-in resolves the same operator and profile", async () => {
    const first = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub-back" },
      profile: { sub: "sub-back", email: "validsstudio@gmail.com", name: "Valid" },
    });
    const profile = await createManagedProfile(first.operator.id, { displayName: "DJ Coast", slug: "dj-coast" });
    const second = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub-back" },
      profile: { sub: "sub-back", email: "validsstudio@gmail.com", name: "Valid" },
    });
    expect(second.operator.id).toBe(first.operator.id);
    const profiles = await listProfilesForOperator(second.operator.id);
    expect(profiles).toHaveLength(1);
    expect(profiles[0].id).toBe(profile.id);
  });

  it("local writes mark Operator and ManagedProfile sync pending", async () => {
    const operator = await upsertOperatorFromGoogle({
      googleSub: "sub-sync",
      email: "validsstudio@gmail.com",
    });
    const profile = await createManagedProfile(operator.id, {
      displayName: "DJ Coast",
      shortDescription: "v1",
    });
    const updated = await updateManagedProfile(profile.id, { shortDescription: "v2" });
    expect(updated.shortDescription).toBe("v2");
    expect(updated.revision).toBeGreaterThan(1);
    const pending = await listPending();
    expect(pending.some((item) => item.collection === COLLECTIONS.operators)).toBe(true);
    expect(pending.some((item) => item.collection === COLLECTIONS.managed_profiles)).toBe(true);
    const { pushOutboxToRemote } = await import("../db/index.js");
    const remote = await pushOutboxToRemote();
    expect(remote.skipped).toBe(true);
    expect((await get(COLLECTIONS.managed_profiles, profile.id)).syncStatus).toBe("PENDING");
  });

  it("public operator payload omits googleSub", () => {
    const published = publicOperator({
      id: "opr_1",
      googleSub: "should-not-leak",
      email: "validsstudio@gmail.com",
      name: "Valid",
      accessToken: "tok",
    });
    expect(published.googleSub).toBeUndefined();
    expect(published.accessToken).toBeUndefined();
    expect(published.email).toBe("validsstudio@gmail.com");
  });

  it("emptyManagedProfile keeps website null when blank", () => {
    expect(emptyManagedProfile({ displayName: "X", website: "" }).website).toBeNull();
    expect(emptyManagedProfile({ displayName: "X", website: null }).website).toBeNull();
  });
});
