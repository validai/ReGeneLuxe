import { COLLECTIONS, upsert } from "./index.js";
import { googleEmailsMatch, normalizeGoogleEmail } from "../../src/data/googleIdentity.js";
import { nowIso } from "../../src/data/ids.js";
import { getOperator, updateOperator, upsertOperatorFromGoogle } from "./operatorRepository.js";
import {
  getManagedProfile,
  listManagedProfiles,
  listProfileConnections,
  updateManagedProfile,
} from "./managedProfileRepository.js";

export async function findProfileByGoogleIdentity({ email = "", googleSub = "" } = {}) {
  const needleEmail = normalizeGoogleEmail(email);
  const needleSub = String(googleSub || "").trim();
  if (!needleEmail && !needleSub) return null;
  const profiles = await listManagedProfiles();
  return profiles.find((profile) => {
    if (needleSub && String(profile.googleAccountSub || "").trim() === needleSub) return true;
    if (needleEmail && googleEmailsMatch(profile.googleAccountEmail, needleEmail)) return true;
    return false;
  }) || null;
}

export async function bindProfileGoogleIdentity(profileId, { email = "", googleSub = "" } = {}) {
  const profile = await getManagedProfile(profileId);
  if (!profile) return null;
  const nextEmail = normalizeGoogleEmail(email) || normalizeGoogleEmail(profile.googleAccountEmail);
  const nextSub = String(googleSub || profile.googleAccountSub || "").trim();
  return updateManagedProfile(profileId, {
    googleAccountEmail: nextEmail,
    googleAccountSub: nextSub,
  });
}

export async function reassignProfileOwner(profileId, toOperatorId) {
  const profile = await getManagedProfile(profileId);
  if (!profile) throw new Error("Managed profile not found");
  const nextOwner = String(toOperatorId || "");
  if (!nextOwner) throw new Error("toOperatorId is required");
  if (profile.ownerOperatorId === nextOwner) return profile;

  const saved = await updateManagedProfile(profileId, { ownerOperatorId: nextOwner }, { allowOwnerChange: true });
  const connections = await listProfileConnections(profileId);
  for (const row of connections) {
    await upsert(COLLECTIONS.profile_connections, {
      ...row,
      ownerOperatorId: nextOwner,
      updatedAt: nowIso(),
    });
  }
  return saved;
}

/**
 * Attach an incoming Google principal to an already-owned ManagedProfile.
 * Operator login itself should not call this — Gmail/YouTube are separate connections.
 */
export async function claimBoundProfile(profile, googleIdentity = {}) {
  if (!profile?.id) throw new Error("profile is required");
  const nextOperator = await upsertOperatorFromGoogle({
    googleSub: googleIdentity.googleSub,
    email: googleIdentity.email,
    emailVerified: googleIdentity.emailVerified,
    name: googleIdentity.name || "",
    avatarUrl: googleIdentity.avatarUrl || "",
  });
  const previousOwnerId = profile.ownerOperatorId;
  const savedProfile = previousOwnerId === nextOperator.id
    ? profile
    : await reassignProfileOwner(profile.id, nextOperator.id);

  await updateOperator(nextOperator.id, {
    activeProfileId: savedProfile.id,
    status: "ACTIVE",
  });

  if (previousOwnerId && previousOwnerId !== nextOperator.id) {
    const remaining = (await listManagedProfiles()).filter((row) => (
      row.ownerOperatorId === previousOwnerId && row.id !== savedProfile.id
    ));
    await updateOperator(previousOwnerId, {
      activeProfileId: remaining[0]?.id || null,
      status: remaining.length ? "ACTIVE" : "INACTIVE",
    });
  }

  return {
    operator: await getOperator(nextOperator.id),
    profile: await getManagedProfile(savedProfile.id),
    previousOwnerId,
  };
}

export async function bindExistingGoogleIdentities() {
  return [];
}
