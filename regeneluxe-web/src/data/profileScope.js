import { STORAGE_KEYS } from "./storage.js";
import { bridgeGetMeta, bridgeSetMeta } from "./repoBridge.js";

export function getActiveProfileId() {
  return bridgeGetMeta("active_profile_id", STORAGE_KEYS.activeProfileId) || null;
}

export function setActiveProfileId(id) {
  const next = id && String(id) ? String(id) : null;
  return bridgeSetMeta("active_profile_id", STORAGE_KEYS.activeProfileId, next);
}

export function stampProfile(record = {}) {
  if (record?.managedProfileId) return record;
  const profileId = getActiveProfileId();
  if (!profileId) return record;
  return { ...record, managedProfileId: profileId };
}

/**
 * Repository scoping:
 * - No active profile (tests / pre-onboarding) → return all records
 * - Active profile → only records owned by that profile
 * - `{ scoped: false }` → unscoped (backup, migration)
 * - `{ profileId }` → explicit profile
 */
export function filterByActiveProfile(records, options = {}) {
  const list = Array.isArray(records) ? records : [];
  if (options.scoped === false) return list;
  const profileId = options.profileId !== undefined ? options.profileId : getActiveProfileId();
  if (!profileId) return list;
  return list.filter((row) => row?.managedProfileId === profileId);
}
