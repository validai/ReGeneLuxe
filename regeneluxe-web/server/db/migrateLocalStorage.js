import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { getLocalClient } from "./client.js";
import { COLLECTIONS } from "./collections.js";
import { backupsDir, ensureDirs } from "./paths.js";
import {
  count,
  getMeta,
  replaceAll,
  setMeta,
  upsert,
} from "./repository.js";

const LS = {
  campaigns: "rl_campaigns_v1",
  accounts: "rl_accounts_v1",
  settings: "rl_settings_v1",
  content: "rl_content_v1",
  inbox: "rl_inbox_v1",
  analytics: "rl_analytics_v1",
  queue: "rl_queue_v1",
  decisions: "rl_decisions_v1",
  activity: "rl_activity_v1",
  events: "rl_events_v1",
  campaignSnapshots: "rl_campaign_snapshots_v1",
  activeCampaignId: "rl_active_campaign_id",
  workingAccountId: "rl_working_account_id",
  sidebar: "rl_sidebar_collapsed",
  contentView: "rl_content_view",
  calendarView: "rl_calendar_view",
  schemaVersion: "rl_schema_version",
};

function parseValue(raw) {
  if (raw == null) return null;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [];
}

/**
 * Import a localStorage key→value dump into SQLite.
 * Idempotent when meta.localstorage_migration === complete_v1.
 */
export async function migrateLocalStorageDump(dump) {
  const db = getLocalClient();
  const existing = await getMeta("localstorage_migration", db);
  if (existing === "complete_v1") {
    return { skipped: true, reason: "already_complete_v1" };
  }

  ensureDirs();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(backupsDir(), `pre_migration_${stamp}.json`);
  writeFileSync(backupPath, JSON.stringify(dump ?? {}, null, 2));

  const src = dump && typeof dump === "object" ? dump : {};
  const get = (key) => parseValue(src[key]);

  const accounts = asArray(get(LS.accounts));
  const campaigns = asArray(get(LS.campaigns));
  let content = asArray(get(LS.content));
  const analytics = asArray(get(LS.analytics));
  const inbox = asArray(get(LS.inbox));
  const queue = asArray(get(LS.queue));
  const decisions = asArray(get(LS.decisions));
  const activity = asArray(get(LS.activity));
  const events = asArray(get(LS.events));
  const settings = get(LS.settings);
  const campaignSnapshots = asArray(get(LS.campaignSnapshots));

  const campaignResults = [];
  if (!content.length) {
    for (const campaign of campaigns) {
      for (const asset of campaign.assets || []) {
        content.push({
          ...asset,
          id: asset.id,
          campaignId: campaign.id,
          createdAt: asset.createdAt || campaign.createdAt,
          updatedAt: asset.updatedAt || campaign.updatedAt || campaign.createdAt,
        });
      }
    }
  }
  for (const campaign of campaigns) {
    for (const result of campaign.results || []) {
      campaignResults.push({
        ...result,
        id: result.id || `${campaign.id}_result_${campaignResults.length}`,
        campaignId: campaign.id,
        createdAt: result.createdAt || campaign.createdAt,
        updatedAt: result.updatedAt || campaign.updatedAt || campaign.createdAt,
      });
    }
  }

  await replaceAll(COLLECTIONS.accounts, accounts, db);
  await replaceAll(COLLECTIONS.campaigns, campaigns, db);
  await replaceAll(COLLECTIONS.content, content, db);
  await replaceAll(COLLECTIONS.analytics, analytics, db);
  await replaceAll(COLLECTIONS.campaign_results, campaignResults, db);
  await replaceAll(COLLECTIONS.inbox, inbox, db);
  await replaceAll(COLLECTIONS.queue, queue, db);
  await replaceAll(COLLECTIONS.decisions, decisions, db);
  await replaceAll(COLLECTIONS.activity, activity, db);
  await replaceAll(COLLECTIONS.events, events, db);

  if (settings && typeof settings === "object" && !Array.isArray(settings)) {
    await upsert(COLLECTIONS.settings, { id: "default", ...settings }, db);
  }

  const prefs = {
    id: "default",
    activeCampaignId: get(LS.activeCampaignId) || null,
    workingAccountId: get(LS.workingAccountId) || null,
    sidebarCollapsed: get(LS.sidebar) || null,
    contentView: get(LS.contentView) || null,
    calendarView: get(LS.calendarView) || null,
  };
  await upsert(COLLECTIONS.ui_prefs, prefs, db);

  if (campaignSnapshots.length) {
    await replaceAll(COLLECTIONS.campaign_snapshots, campaignSnapshots, db);
  }

  const counts = {
    accounts: await count(COLLECTIONS.accounts, {}, db),
    campaigns: await count(COLLECTIONS.campaigns, {}, db),
    content: await count(COLLECTIONS.content, {}, db),
    analytics: await count(COLLECTIONS.analytics, {}, db),
    campaign_results: await count(COLLECTIONS.campaign_results, {}, db),
    inbox: await count(COLLECTIONS.inbox, {}, db),
    queue: await count(COLLECTIONS.queue, {}, db),
    decisions: await count(COLLECTIONS.decisions, {}, db),
    activity: await count(COLLECTIONS.activity, {}, db),
    events: await count(COLLECTIONS.events, {}, db),
  };

  await setMeta("localstorage_migration", "complete_v1", db);
  await setMeta("localstorage_backup_path", backupPath, db);
  if (get(LS.schemaVersion) != null) {
    await setMeta("imported_localstorage_schema", String(get(LS.schemaVersion)), db);
  }

  return {
    skipped: false,
    backupPath,
    counts,
    expected: {
      accounts: accounts.length,
      campaigns: campaigns.length,
      content: content.length,
      analytics: analytics.length,
      campaign_results: campaignResults.length,
      inbox: inbox.length,
      queue: queue.length,
      decisions: decisions.length,
      activity: activity.length,
      events: events.length,
    },
  };
}
