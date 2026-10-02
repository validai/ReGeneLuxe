import { STORAGE_KEYS } from "./storage.js";
import { bridgeGetMeta, bridgeSetMeta } from "./repoBridge.js";

/**
 * Tenant stamp for the current account workspace.
 * The meta key remains active_profile_id during schema migration.
 */
export function getActiveProfileId() {
  return bridgeGetMeta("active_profile_id", STORAGE_KEYS.activeProfileId) || null;
}

export function setActiveProfileId(id) {
  const next = id && String(id) ? String(id) : null;
  return bridgeSetMeta("active_profile_id", STORAGE_KEYS.activeProfileId, next);
}

export const getCurrentWorkspaceId = getActiveProfileId;
export const setCurrentWorkspaceId = setActiveProfileId;

export function stampProfile(record = {}) {
  if (record?.managedProfileId) return record;
  const workspaceId = getCurrentWorkspaceId();
  if (!workspaceId) return record;
  return { ...record, managedProfileId: workspaceId };
}

/**
 * Repository scoping by account/workspace id (managedProfileId stamp).
 * - No workspace selected (tests / pre-onboarding) → return all records
 * - Workspace selected → only records owned by that workspace
 * - `{ scoped: false }` → unscoped (backup, migration)
 * - `{ profileId }` → explicit workspace
 */
export function filterByActiveProfile(records, options = {}) {
  const list = Array.isArray(records) ? records : [];
  if (options.scoped === false) return list;
  const workspaceId = options.profileId !== undefined ? options.profileId : getCurrentWorkspaceId();
  if (!workspaceId) return list;
  return list.filter((row) => row?.managedProfileId === workspaceId);
}
