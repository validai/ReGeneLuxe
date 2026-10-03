import { COLLECTIONS } from "../db/collections.js";
import { listForProfile, PROFILE_SCOPED_COLLECTIONS } from "../db/profileMigration.js";
import { publicOperator, publicManagedProfile } from "../../src/data/profileModels.js";
import { stripSecretFields } from "../../src/data/secretFields.js";

export const CLIENT_HIDDEN_COLLECTIONS = new Set([
  COLLECTIONS.gmail_messages,
  COLLECTIONS.operators,
]);

export function workspaceIdOf(authz) {
  return authz?.workspace?.id || authz?.activeProfile?.id || null;
}

export async function listWorkspaceCollection(collection, authz) {
  const workspaceId = workspaceIdOf(authz);
  if (CLIENT_HIDDEN_COLLECTIONS.has(collection)) return [];
  if (collection === COLLECTIONS.managed_profiles) {
    return authz.workspace ? [authz.workspace] : [];
  }
  if (collection === COLLECTIONS.profile_connections) {
    const rows = await listForProfile(collection, workspaceId);
    return stripSecretFields(rows);
  }
  if (PROFILE_SCOPED_COLLECTIONS.includes(collection) || collection === COLLECTIONS.youtube_videos) {
    return listForProfile(collection, workspaceId);
  }
  if (collection === COLLECTIONS.settings || collection === COLLECTIONS.ui_prefs) {
    const { list } = await import("../db/index.js");
    return list(collection);
  }
  return listForProfile(collection, workspaceId);
}

export function recordBelongsToWorkspace(record, authz) {
  const workspaceId = workspaceIdOf(authz);
  if (!record || !workspaceId) return false;
  if (record.managedProfileId) return record.managedProfileId === workspaceId;
  if (record.ownerOperatorId) return record.ownerOperatorId === authz.operator.id;
  if (record.id && (record.id === workspaceId || record.id === authz.operator.id)) return true;
  return false;
}

export function stampWorkspaceRecord(record, authz) {
  const workspaceId = workspaceIdOf(authz);
  if (!record || !workspaceId) return record;
  return {
    ...record,
    managedProfileId: workspaceId,
    ownerOperatorId: record.ownerOperatorId || authz.operator.id,
  };
}

export function publicSnapshotForWorkspace(raw, authz) {
  const workspaceId = workspaceIdOf(authz);
  const inWorkspace = (rows) => (Array.isArray(rows) ? rows.filter((row) => !row?.managedProfileId || row.managedProfileId === workspaceId) : []);
  return {
    ...raw,
    campaigns: inWorkspace(raw.campaigns),
    accounts: inWorkspace(raw.accounts),
    content: inWorkspace(raw.content),
    inbox: inWorkspace(raw.inbox),
    analytics: inWorkspace(raw.analytics),
    queue: inWorkspace(raw.queue),
    decisions: inWorkspace(raw.decisions),
    activity: inWorkspace(raw.activity),
    events: inWorkspace(raw.events),
    campaignSnapshots: inWorkspace(raw.campaignSnapshots),
    operators: [publicOperator(authz.operator)].filter(Boolean),
    managedProfiles: authz.workspace ? [publicManagedProfile(authz.workspace)] : [],
    profileConnections: stripSecretFields(inWorkspace(raw.profileConnections)),
  };
}
