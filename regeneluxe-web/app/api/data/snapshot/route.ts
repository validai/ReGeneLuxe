import { NextResponse } from "next/server";
import {
  COLLECTIONS,
  initDb,
  list,
  getMeta,
} from "../../../../server/db/index.js";
import { publicOperator, publicManagedProfile } from "../../../../src/data/profileModels.js";

export const dynamic = "force-dynamic";

async function snapshot() {
  await initDb();
  const [
    campaigns,
    accounts,
    content,
    inbox,
    analytics,
    queue,
    decisions,
    activity,
    events,
    settingsRows,
    uiPrefs,
    campaignSnapshots,
    operators,
    managedProfiles,
    profileConnections,
  ] = await Promise.all([
    list(COLLECTIONS.campaigns),
    list(COLLECTIONS.accounts),
    list(COLLECTIONS.content),
    list(COLLECTIONS.inbox),
    list(COLLECTIONS.analytics),
    list(COLLECTIONS.queue),
    list(COLLECTIONS.decisions),
    list(COLLECTIONS.activity),
    list(COLLECTIONS.events),
    list(COLLECTIONS.settings),
    list(COLLECTIONS.ui_prefs),
    list(COLLECTIONS.campaign_snapshots),
    list(COLLECTIONS.operators),
    list(COLLECTIONS.managed_profiles),
    list(COLLECTIONS.profile_connections),
  ]);

  const settings = settingsRows[0] || null;
  const prefs = Object.fromEntries(
    uiPrefs.map((row: { id: string; value?: unknown }) => [row.id, row.value]),
  );

  return {
    campaigns,
    accounts,
    content,
    inbox,
    analytics,
    queue,
    decisions,
    activity,
    events,
    settings,
    uiPrefs: prefs,
    campaignSnapshots,
    operators: operators.map((row: Record<string, unknown>) => publicOperator(row)),
    managedProfiles: managedProfiles.map((row: Record<string, unknown>) => publicManagedProfile(row)),
    profileConnections,
    activeCampaignId: await getMeta("active_campaign_id"),
    workingAccountId: await getMeta("working_account_id"),
    activeProfileId: await getMeta("active_profile_id"),
    migration: await getMeta("localstorage_migration"),
  };
}

export async function GET() {
  try {
    const data = await snapshot();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
