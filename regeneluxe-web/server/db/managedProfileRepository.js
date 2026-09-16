import { COLLECTIONS, initDb, list, get, upsert } from "./index.js";
import {
  emptyManagedProfile,
  emptyProfileConnection,
  normalizeWebsite,
  PROFILE_CONNECTION_KINDS,
  PROFILE_CONNECTION_STATES,
  PROFILE_STATUSES,
  publicManagedProfile,
  slugifyProfileName,
} from "../../src/data/profileModels.js";
import { nowIso } from "../../src/data/ids.js";
import { getOperator, updateOperator } from "./operatorRepository.js";
import { attachUnscopedRecordsToProfile } from "./profileMigration.js";

export async function listManagedProfiles() {
  await initDb();
  return list(COLLECTIONS.managed_profiles);
}

export async function listProfilesForOperator(ownerOperatorId) {
  const owner = String(ownerOperatorId || "");
  if (!owner) return [];
  const all = await listManagedProfiles();
  return all.filter((row) => row.ownerOperatorId === owner);
}

export async function getManagedProfile(id) {
  if (!id) return null;
  await initDb();
  return get(COLLECTIONS.managed_profiles, id);
}

export async function findProfileBySlug(slug) {
  const needle = String(slug || "").trim().toLowerCase();
  if (!needle) return null;
  const all = await listManagedProfiles();
  return all.find((row) => String(row.slug || "").toLowerCase() === needle) || null;
}

async function uniqueSlug(desired, excludeId = null) {
  const base = slugifyProfileName(desired) || "profile";
  let slug = base;
  let n = 2;
  while (true) {
    const existing = await findProfileBySlug(slug);
    if (!existing || existing.id === excludeId) return slug;
    slug = `${base}-${n}`;
    n += 1;
  }
}

export async function createManagedProfile(ownerOperatorId, partial = {}) {
  const owner = String(ownerOperatorId || "");
  if (!owner) throw new Error("ownerOperatorId is required");
  const displayName = String(partial.displayName || "").trim();
  if (!displayName) throw new Error("Profile name is required");

  const existingForOwner = await listProfilesForOperator(owner);
  const isFirst = existingForOwner.length === 0;
  const slug = await uniqueSlug(partial.slug || displayName);

  const record = emptyManagedProfile({
    ...partial,
    ownerOperatorId: owner,
    displayName,
    slug,
    status: PROFILE_STATUSES.includes(partial.status) ? partial.status : "ACTIVE",
    website: normalizeWebsite(partial.website),
    primaryPublicUrl: String(partial.primaryPublicUrl || "").trim(),
  });

  const saved = await upsert(COLLECTIONS.managed_profiles, record);
  await seedDefaultProfileConnections(saved);

  if (isFirst) {
    await attachUnscopedRecordsToProfile(saved.id);
    await updateOperator(owner, { activeProfileId: saved.id });
  } else {
    const operator = await getOperator(owner);
    if (!operator?.activeProfileId) {
      await updateOperator(owner, { activeProfileId: saved.id });
    }
  }

  return saved;
}

export async function updateManagedProfile(id, patch = {}) {
  const existing = await getManagedProfile(id);
  if (!existing) return null;
  const next = emptyManagedProfile({
    ...existing,
    ...patch,
    id: existing.id,
    ownerOperatorId: existing.ownerOperatorId,
    createdAt: existing.createdAt,
    updatedAt: nowIso(),
    website: Object.prototype.hasOwnProperty.call(patch, "website")
      ? normalizeWebsite(patch.website)
      : existing.website,
  });
  if (patch.slug && patch.slug !== existing.slug) {
    next.slug = await uniqueSlug(patch.slug, existing.id);
  }
  return upsert(COLLECTIONS.managed_profiles, next);
}

export async function setActiveProfileForOperator(operatorId, profileId) {
  if (!operatorId) throw new Error("operatorId is required");
  if (profileId && profileId === operatorId) {
    throw new Error("activeProfileId must not equal operator ID");
  }
  if (profileId) {
    const profile = await getManagedProfile(profileId);
    if (!profile) throw new Error("Managed profile not found");
    if (profile.ownerOperatorId !== operatorId) {
      throw new Error("Profile is not owned by this operator");
    }
  }
  return updateOperator(operatorId, { activeProfileId: profileId || null });
}

export async function listProfileConnections(managedProfileId) {
  await initDb();
  const all = await list(COLLECTIONS.profile_connections);
  if (!managedProfileId) return all;
  return all.filter((row) => row.managedProfileId === managedProfileId);
}

export async function seedDefaultProfileConnections(profile) {
  const existing = await listProfileConnections(profile.id);
  const kinds = [PROFILE_CONNECTION_KINDS.GMAIL, PROFILE_CONNECTION_KINDS.YOUTUBE];
  const created = [];
  for (const kind of kinds) {
    if (existing.some((row) => row.kind === kind)) continue;
    const row = await upsert(COLLECTIONS.profile_connections, emptyProfileConnection({
      managedProfileId: profile.id,
      ownerOperatorId: profile.ownerOperatorId,
      kind,
      provider: kind.toLowerCase(),
      status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
      displayLabel: kind === PROFILE_CONNECTION_KINDS.GMAIL ? "Gmail" : "YouTube",
      notes: "Authorization is separate from Google sign-in.",
    }));
    created.push(row);
  }
  return created;
}

export function toPublicProfile(profile) {
  return publicManagedProfile(profile);
}

export async function getProfileConnectionByKind(managedProfileId, kind) {
  const rows = await listProfileConnections(managedProfileId);
  return rows.find((row) => row.kind === kind) || null;
}

export async function upsertProfileConnection(partial = {}) {
  const existing = partial.id
    ? await get(COLLECTIONS.profile_connections, partial.id)
    : await getProfileConnectionByKind(partial.managedProfileId, partial.kind);
  return upsert(COLLECTIONS.profile_connections, emptyProfileConnection({
    ...existing,
    ...partial,
    id: existing?.id || partial.id,
    createdAt: existing?.createdAt || partial.createdAt,
    updatedAt: nowIso(),
  }));
}

export async function ensureProfileConnection(profile, kind) {
  const existing = await getProfileConnectionByKind(profile.id, kind);
  if (existing) return existing;
  return upsertProfileConnection({
    managedProfileId: profile.id,
    ownerOperatorId: profile.ownerOperatorId,
    kind,
    provider: String(kind || "").toLowerCase(),
    status: PROFILE_CONNECTION_STATES.NOT_CONNECTED,
    displayLabel: kind === PROFILE_CONNECTION_KINDS.GMAIL ? "Gmail" : "YouTube",
    notes: "Authorization is separate from Google sign-in.",
  });
}
