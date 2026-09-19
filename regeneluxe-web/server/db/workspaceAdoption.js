import { isEmailAllowed } from "../auth/allowlist.js";
import { getOperator, listOperators, updateOperator } from "./operatorRepository.js";
import { listManagedProfiles, listProfilesForOperator } from "./managedProfileRepository.js";
import { reassignProfileOwner } from "./googleIdentityBinding.js";

/**
 * If the signed-in ReGeneLuxe account has no ManagedProfiles yet, adopt the
 * single leftover workspace owned by a non-allowlisted account (infrastructure
 * identity). Never duplicates profiles. Never deletes the previous account row.
 *
 * @param {{ id: string, email?: string, activeProfileId?: string }} account
 */
export async function adoptWorkspaceForAccount(account) {
  if (!account?.id) {
    return { adopted: false, reason: "missing_account", profiles: [] };
  }
  const owned = await listProfilesForOperator(account.id);
  if (owned.length) {
    return { adopted: false, reason: "already_owns_profiles", profiles: owned };
  }

  const all = await listManagedProfiles();
  const byOwner = new Map();
  for (const profile of all) {
    const ownerId = String(profile.ownerOperatorId || "");
    if (!ownerId || ownerId === account.id) continue;
    const rows = byOwner.get(ownerId) || [];
    rows.push(profile);
    byOwner.set(ownerId, rows);
  }

  const candidates = [];
  for (const [ownerId, profiles] of byOwner) {
    const owner = await getOperator(ownerId);
    if (owner && isEmailAllowed(owner.email)) continue;
    candidates.push({ ownerId, profiles, owner });
  }

  if (candidates.length !== 1) {
    return {
      adopted: false,
      reason: candidates.length ? "ambiguous" : "none",
      profiles: [],
    };
  }

  const { ownerId, profiles } = candidates[0];
  const transferred = [];
  for (const profile of profiles) {
    transferred.push(await reassignProfileOwner(profile.id, account.id));
  }

  await updateOperator(account.id, {
    activeProfileId: transferred[0]?.id || account.activeProfileId || null,
    status: "ACTIVE",
  });

  const remaining = await listProfilesForOperator(ownerId);
  if (await getOperator(ownerId)) {
    await updateOperator(ownerId, {
      activeProfileId: remaining[0]?.id || null,
    });
  }

  return {
    adopted: true,
    reason: "adopted",
    profiles: transferred,
    previousOwnerId: ownerId,
    operatorsPreserved: (await listOperators()).length,
  };
}
