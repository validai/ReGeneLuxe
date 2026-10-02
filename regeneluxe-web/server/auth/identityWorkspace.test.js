import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_DB_MODE = "memory";
process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, closeDb, list, upsert, COLLECTIONS } = await import("../db/index.js");
const { authorizeGoogleSignIn } = await import("./authorizeGoogle.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const {
  createManagedProfile,
  getCurrentCampaigns,
  getCurrentConnections,
  getCurrentWorkspace,
  listProfilesForOperator,
} = await import("../db/managedProfileRepository.js");
const { publicOperator, resolveWorkspace, SECOND_WORKSPACE_MESSAGE } = await import("../../src/data/profileModels.js");
const { assertMatchesSignedInGoogleAccount, GOOGLE_ACCOUNT_MISMATCH_MESSAGE } = await import("../../src/data/googleIdentity.js");

describe("one email = one account = one workspace", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com";
    await resetDbForTests();
    await initDb();
  });

  afterEach(async () => {
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com";
    await closeDb();
  });

  it("maps one email to one account workspace", async () => {
    const login = await authorizeGoogleSignIn({
      profile: { sub: "coast-sub", email: "djcoast239@gmail.com", name: "Coast Ent" },
    });
    expect(login.ok).toBe(true);
    const workspace = await createManagedProfile(login.operator.id, {
      displayName: "DJ Coast",
      slug: "dj-coast",
      primaryEmail: "djcoast239@gmail.com",
    });
    expect(await getCurrentWorkspace(login.operator.id)).toEqual(expect.objectContaining({
      id: workspace.id,
      displayName: "DJ Coast",
    }));
    expect(await listProfilesForOperator(login.operator.id)).toHaveLength(1);
  });

  it("rejects a second brand under the same account", async () => {
    const account = await upsertOperatorFromGoogle({
      googleSub: "coast-sub",
      email: "djcoast239@gmail.com",
    });
    await createManagedProfile(account.id, { displayName: "DJ Coast", slug: "dj-coast" });
    await expect(createManagedProfile(account.id, { displayName: "Profile #2" }))
      .rejects.toThrow(SECOND_WORKSPACE_MESSAGE);
    expect(await list(COLLECTIONS.managed_profiles)).toHaveLength(1);
  });

  it("creates a separate workspace for a different email", async () => {
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com,brand2@email.com";
    const coast = await upsertOperatorFromGoogle({
      googleSub: "coast-sub",
      email: "djcoast239@gmail.com",
    });
    const brand2 = await upsertOperatorFromGoogle({
      googleSub: "brand2-sub",
      email: "brand2@email.com",
    });
    const coastWorkspace = await createManagedProfile(coast.id, { displayName: "DJ Coast" });
    const brand2Workspace = await createManagedProfile(brand2.id, { displayName: "Brand 2" });
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_coast",
      name: "Coast campaign",
      managedProfileId: coastWorkspace.id,
    });
    await upsert(COLLECTIONS.campaigns, {
      id: "camp_brand2",
      name: "Brand 2 campaign",
      managedProfileId: brand2Workspace.id,
    });
    expect((await getCurrentCampaigns(coast.id)).map((row) => row.id)).toEqual(["camp_coast"]);
    expect((await getCurrentCampaigns(brand2.id)).map((row) => row.id)).toEqual(["camp_brand2"]);
    expect(await getCurrentWorkspace(coast.id)).toEqual(expect.objectContaining({ id: coastWorkspace.id }));
    expect(await getCurrentWorkspace(brand2.id)).toEqual(expect.objectContaining({ id: brand2Workspace.id }));
  });

  it("does not use activeProfileId to pick among workspaces", () => {
    const one = { id: "prf_1", displayName: "DJ Coast" };
    const two = { id: "prf_2", displayName: "Second" };
    expect(resolveWorkspace({ activeProfileId: two.id }, [one, two]).id).toBe("prf_1");
  });

  it("omits activeProfileId from the public account payload", () => {
    expect(publicOperator({
      id: "opr_1",
      email: "djcoast239@gmail.com",
      activeProfileId: "prf_1",
    }).activeProfileId).toBeUndefined();
  });

  it("keeps Valids Studio out of runtime login", async () => {
    const denied = await authorizeGoogleSignIn({
      profile: { sub: "studio-sub", email: "validsstudio@gmail.com", name: "Studio" },
    });
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe("not_allowlisted");
  });

  it("returns the same DJ Coast workspace after sign-out and sign-in", async () => {
    const first = await authorizeGoogleSignIn({
      profile: { sub: "coast-sub", email: "djcoast239@gmail.com", name: "Coast Ent" },
    });
    const workspace = await createManagedProfile(first.operator.id, {
      displayName: "DJ Coast",
      slug: "dj-coast",
    });
    const second = await authorizeGoogleSignIn({
      profile: { sub: "coast-sub", email: "djcoast239@gmail.com", name: "Coast Ent" },
    });
    expect(second.operator.id).toBe(first.operator.id);
    expect((await getCurrentWorkspace(second.operator.id)).id).toBe(workspace.id);
    expect(await list(COLLECTIONS.managed_profiles)).toHaveLength(1);
  });

  it("loads connections for the current account workspace only", async () => {
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "djcoast239@gmail.com,brand2@email.com";
    const coast = await upsertOperatorFromGoogle({
      googleSub: "coast-sub",
      email: "djcoast239@gmail.com",
    });
    const brand2 = await upsertOperatorFromGoogle({
      googleSub: "brand2-sub",
      email: "brand2@email.com",
    });
    await createManagedProfile(coast.id, { displayName: "DJ Coast" });
    await createManagedProfile(brand2.id, { displayName: "Brand 2" });
    const coastConnections = await getCurrentConnections(coast.id);
    const brand2Connections = await getCurrentConnections(brand2.id);
    expect(coastConnections.every((row) => row.managedProfileId !== brand2Connections[0]?.managedProfileId)).toBe(true);
    expect(new Set(coastConnections.map((row) => row.managedProfileId)).size).toBe(1);
  });

  it("rejects Gmail/YouTube OAuth from a different Google identity", () => {
    const account = { googleSub: "coast-sub", email: "djcoast239@gmail.com" };
    expect(assertMatchesSignedInGoogleAccount(account, {
      sub: "other-sub",
      email: "other@gmail.com",
    })).toEqual({ ok: false, error: GOOGLE_ACCOUNT_MISMATCH_MESSAGE });
    expect(assertMatchesSignedInGoogleAccount(account, {
      sub: "coast-sub",
      email: "djcoast239@gmail.com",
    }).ok).toBe(true);
  });
});
