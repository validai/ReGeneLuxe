import { afterAll, beforeEach, describe, expect, it } from "vitest";

process.env.APP_ALLOWED_GOOGLE_EMAILS = "pilot@example.com";
process.env.RL_DB_MODE = "memory";

const { initDb, resetDbForTests, closeDb } = await import("../db/index.js");
const {
  createProfileInvite,
  evaluatePilotEmailAccess,
  findValidInviteForEmail,
  consumeProfileInvite,
  getActiveProfileInvite,
  inviteIsActive,
  normalizeInviteEmail,
  PROFILE_INVITE_TTL_MS,
} = await import("./profileInvite.js");
const { authorizeGoogleSignIn } = await import("./authorizeGoogle.js");
const { createManagedProfile, getWorkspaceForAccount } = await import("../db/managedProfileRepository.js");

describe("profile create invite authorization", () => {
  beforeEach(async () => {
    process.env.APP_ALLOWED_GOOGLE_EMAILS = "pilot@example.com";
    await resetDbForTests();
    await initDb();
  });

  it("keeps unsolicited emails fail-closed on the pilot allowlist", async () => {
    const denied = await evaluatePilotEmailAccess("stranger@example.com");
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe("not_allowlisted");
  });

  it("allows an existing allowlisted email", async () => {
    const ok = await evaluatePilotEmailAccess("PILOT@example.com");
    expect(ok.ok).toBe(true);
    expect(ok.via).toBe("ALLOWLIST");
  });

  it("authorizes a one-time invite email and rejects the wrong Google account", async () => {
    await createProfileInvite({
      createdByOperatorId: "opr_pilot",
      email: "Artist.Alt@Gmail.com",
    });
    const match = await evaluatePilotEmailAccess("artist.alt@gmail.com");
    expect(match.ok).toBe(true);
    expect(match.via).toBe("PROFILE_INVITE");

    const mismatch = await evaluatePilotEmailAccess("other@gmail.com");
    expect(mismatch.ok).toBe(false);
    expect(mismatch.reason).toBe("invite_mismatch");
  });

  it("expires invites and rejects replay after consume", async () => {
    const short = await createProfileInvite({
      createdByOperatorId: "opr_pilot",
      email: "artist@gmail.com",
      ttlMs: 20,
    });
    expect(short.invite.active).toBe(true);
    await new Promise((r) => setTimeout(r, 35));
    expect(await getActiveProfileInvite()).toBe(null);

    const fresh = await createProfileInvite({
      createdByOperatorId: "opr_pilot",
      email: "artist@gmail.com",
    });
    const first = await consumeProfileInvite(fresh.invite.id, "opr_artist", "profile_created");
    expect(first.ok).toBe(true);
    const second = await consumeProfileInvite(fresh.invite.id, "opr_artist", "profile_created");
    expect(second.ok).toBe(false);
    expect(second.reason).toBe("already_consumed");
    expect(await findValidInviteForEmail("artist@gmail.com")).toBe(null);
  });

  it("lets an invited Google identity create an isolated TEST workspace", async () => {
    await createProfileInvite({
      createdByOperatorId: "opr_pilot",
      email: "artist@gmail.com",
    });

    const denied = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub_stranger" },
      profile: { sub: "sub_stranger", email: "stranger@gmail.com", email_verified: true },
    });
    expect(denied.ok).toBe(false);
    expect(denied.reason).toBe("invite_mismatch");

    const approved = await authorizeGoogleSignIn({
      account: { provider: "google", providerAccountId: "sub_artist" },
      profile: { sub: "sub_artist", email: "artist@gmail.com", email_verified: true, name: "Artist" },
    });
    expect(approved.ok).toBe(true);
    expect(approved.operator.pilotAccessGrant).toBe("PROFILE_INVITE");
    expect(await getWorkspaceForAccount(approved.operator.id)).toBe(null);

    const profile = await createManagedProfile(approved.operator.id, {
      displayName: "Alternate Artist",
      workspacePurpose: "TEST",
      platforms: ["Other"],
      primaryEmail: "artist@gmail.com",
    });
    expect(profile.workspacePurpose).toBe("TEST");
    expect(profile.ownerOperatorId).toBe(approved.operator.id);

    const invite = await findValidInviteForEmail("artist@gmail.com");
    if (invite) {
      await consumeProfileInvite(invite.id, approved.operator.id, "profile_created");
    }
    expect(await findValidInviteForEmail("artist@gmail.com")).toBe(null);

    // Double create is idempotent for the same owner.
    const again = await createManagedProfile(approved.operator.id, {
      displayName: "Alternate Artist",
      workspacePurpose: "TEST",
    });
    expect(again.id).toBe(profile.id);
  });

  it("normalizes invite emails", () => {
    expect(normalizeInviteEmail("  A@B.COM ")).toBe("a@b.com");
    expect(inviteIsActive({ status: "PENDING", expiresAt: new Date(Date.now() + PROFILE_INVITE_TTL_MS).toISOString() })).toBe(true);
    expect(inviteIsActive({ status: "PENDING", expiresAt: new Date(Date.now() - 1000).toISOString() })).toBe(false);
  });
});

afterAll(async () => {
  await closeDb().catch(() => {});
});
