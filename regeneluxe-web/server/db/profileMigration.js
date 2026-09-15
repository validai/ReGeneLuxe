import { COLLECTIONS, initDb, list, upsert } from "./index.js";
import { isFixtureRecord } from "../../src/data/profileModels.js";

/** Collections that belong to a ManagedProfile once the Profile Lane exists. */
export const PROFILE_SCOPED_COLLECTIONS = [
  COLLECTIONS.campaigns,
  COLLECTIONS.accounts,
  COLLECTIONS.content,
  COLLECTIONS.inbox,
  COLLECTIONS.analytics,
  COLLECTIONS.queue,
  COLLECTIONS.decisions,
  COLLECTIONS.activity,
  COLLECTIONS.events,
  COLLECTIONS.campaign_snapshots,
  COLLECTIONS.attention,
  COLLECTIONS.approvals,
  COLLECTIONS.brain_runs,
  COLLECTIONS.monitor_runs,
  COLLECTIONS.experiments,
  COLLECTIONS.campaign_results,
  COLLECTIONS.campaign_changes,
  COLLECTIONS.publications,
  COLLECTIONS.publication_attempts,
];

/**
 * When the first ManagedProfile is created, attach existing unscoped operator
 * records to it. IDs and relationships are preserved.
 *
 * Never attaches fixture/test provenance rows.
 * Never overwrites a record that already has managedProfileId.
 */
export async function attachUnscopedRecordsToProfile(profileId) {
  if (!profileId) throw new Error("profileId is required");
  await initDb();
  const attached = {};

  for (const collection of PROFILE_SCOPED_COLLECTIONS) {
    const rows = await list(collection);
    let count = 0;
    for (const row of rows) {
      if (!row?.id) continue;
      if (row.managedProfileId) continue;
      if (isFixtureRecord(row)) continue;
      await upsert(collection, { ...row, managedProfileId: profileId });
      count += 1;
    }
    attached[collection] = count;
  }

  return attached;
}

export async function listForProfile(collection, profileId) {
  await initDb();
  const rows = await list(collection);
  if (!profileId) return rows;
  return rows.filter((row) => row?.managedProfileId === profileId);
}
