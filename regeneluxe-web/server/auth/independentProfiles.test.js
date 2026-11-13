import { afterAll, beforeEach, describe, expect, it } from "vitest";

process.env.APP_ALLOWED_GOOGLE_EMAILS = "pilot@example.com";
process.env.REGENELUXE_ACCESS_MODE = "local";
process.env.RL_DB_MODE = "memory";
process.env.REGENELUXE_ALLOW_LEGACY_ATTACH = "0";

const { initDb, resetDbForTests, closeDb, upsert, COLLECTIONS } = await import("../db/index.js");
const { authorizeVerifiedIdentity } = await import("./authorizeVerifiedIdentity.js");
const { createManagedProfile, getWorkspaceForAccount, listManagedProfiles } = await import("../db/managedProfileRepository.js");
describe("independent profile architecture", () => {
  beforeEach(async () => {
    process.env.REGENELUXE_ACCESS_MODE = "local";
    process.env.REGENELUXE_ALLOW_LEGACY_ATTACH = "0";
    await resetDbForTests();
    await initDb();
  });

  it("onboards two Google identities into isolated workspaces", async () => {
    const a = await authorizeVerifiedIdentity({
      email: "e2e-profile-a@example.invalid",
      sub: "e2e_sub_a",
      name: "Artist A",
    });
    expect(a.ok).toBe(true);
    expect(a.adoption?.adopted).toBe(false);

    const profileA = await createManagedProfile(a.operator.id, {
      displayName: "E2E Artist A",
      workspacePurpose: "TEST",
      platforms: ["Other"],
      primaryEmail: "e2e-profile-a@example.invalid",
    });

    const b = await authorizeVerifiedIdentity({
      email: "e2e-profile-b@example.invalid",
      sub: "e2e_sub_b",
      name: "Artist B",
    });
    const profileB = await createManagedProfile(b.operator.id, {
      displayName: "E2E Artist B",
      workspacePurpose: "TEST",
      platforms: ["Other"],
      primaryEmail: "e2e-profile-b@example.invalid",
    });

    expect(profileA.ownerOperatorId).toBe(a.operator.id);
    expect(profileB.ownerOperatorId).toBe(b.operator.id);
    expect(profileA.id).not.toBe(profileB.id);

    await upsert(COLLECTIONS.campaigns, {
      id: "camp_a",
      managedProfileId: profileA.id,
      name: "A only",
    });

    const againA = await authorizeVerifiedIdentity({
      email: "e2e-profile-a@example.invalid",
      sub: "e2e_sub_a",
    });
    const workspaceA = await getWorkspaceForAccount(againA.operator.id);
    expect(workspaceA.id).toBe(profileA.id);
    expect(workspaceA.id).not.toBe(profileB.id);

    const all = await listManagedProfiles();
    expect(all).toHaveLength(2);
  });

  it("does not auto-adopt another owner's workspace on sign-in", async () => {
    const first = await authorizeVerifiedIdentity({
      email: "owner@example.invalid",
      sub: "e2e_owner",
    });
    const owned = await createManagedProfile(first.operator.id, {
      displayName: "Owner",
      workspacePurpose: "TEST",
      platforms: ["Other"],
    });

    const second = await authorizeVerifiedIdentity({
      email: "newcomer@example.invalid",
      sub: "e2e_new",
    });
    expect(second.adoption?.adopted).toBe(false);
    expect(await getWorkspaceForAccount(second.operator.id)).toBe(null);
    expect((await getWorkspaceForAccount(first.operator.id)).id).toBe(owned.id);
  });

  it("does not attach legacy unscoped rows by default", async () => {
    await upsert(COLLECTIONS.campaigns, {
      id: "orphan_camp",
      name: "Orphan",
      // no managedProfileId
    });
    const identity = await authorizeVerifiedIdentity({
      email: "first@example.invalid",
      sub: "e2e_first",
    });
    const profile = await createManagedProfile(identity.operator.id, {
      displayName: "First",
      workspacePurpose: "TEST",
      platforms: ["Other"],
    });
    const { get } = await import("../db/index.js");
    const orphan = await get(COLLECTIONS.campaigns, "orphan_camp");
    expect(orphan.managedProfileId).toBeFalsy();
    expect(profile.id).toBeTruthy();
  });

  it("idempotent double create for the same identity", async () => {
    const identity = await authorizeVerifiedIdentity({
      email: "dup@example.invalid",
      sub: "e2e_dup",
    });
    const one = await createManagedProfile(identity.operator.id, {
      displayName: "Dup",
      workspacePurpose: "TEST",
      platforms: ["Other"],
    });
    const two = await createManagedProfile(identity.operator.id, {
      displayName: "Dup",
      workspacePurpose: "TEST",
      platforms: ["Other"],
    });
    expect(two.id).toBe(one.id);
  });
});

afterAll(async () => {
  await closeDb().catch(() => {});
});
