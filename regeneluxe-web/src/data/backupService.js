import { SCHEMA_VERSION, emptyCampaign, emptyAccount, emptySettings } from "./models.js";
import { migrateCampaigns } from "./migrate.js";
import { listCampaigns, replaceCampaigns } from "./campaignRepository.js";
import { listAccounts, replaceAccounts } from "./accountRepository.js";
import { getSettings, replaceSettings } from "./settingsRepository.js";
import { getActiveCampaignId, setActiveCampaignId } from "./campaignRepository.js";
import {
  listContent,
  listInbox,
  listSnapshots,
  listQueue,
  listDecisions,
  listActivity,
  replaceContent,
  replaceInbox,
  replaceSnapshots,
  replaceQueue,
  replaceDecisions,
  replaceActivity,
} from "./collectionRepository.js";
import { readString, STORAGE_KEYS, replaceAll } from "./storage.js";

const SECRET_KEYS = ["apiKey", "accessToken", "refreshToken", "token", "secret", "password"];

function stripSecrets(value) {
  if (!value || typeof value !== "object") return value;
  const clone = Array.isArray(value) ? value.map(stripSecrets) : { ...value };
  if (!Array.isArray(clone)) {
    SECRET_KEYS.forEach((key) => {
      delete clone[key];
    });
    Object.keys(clone).forEach((key) => {
      clone[key] = stripSecrets(clone[key]);
    });
  }
  return clone;
}

export function exportBackup() {
  return stripSecrets({
    app: "ReGeneLuxe",
    kind: "local-backup",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    accounts: listAccounts(),
    campaigns: listCampaigns(),
    settings: getSettings(),
    content: listContent(),
    inbox: listInbox(),
    analytics: listSnapshots(),
    queue: listQueue(),
    decisions: listDecisions(),
    activity: listActivity(),
    activeCampaignId: getActiveCampaignId(),
  });
}

export function validateBackup(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, error: "Backup must be a JSON object." };
  }

  if (data.kind && data.kind !== "local-backup") {
    return { ok: false, error: "This file is not a ReGeneLuxe local backup." };
  }

  if (data.app && data.app !== "ReGeneLuxe") {
    return { ok: false, error: "This backup is not from ReGeneLuxe." };
  }

  if (data.accounts != null && !Array.isArray(data.accounts)) {
    return { ok: false, error: "accounts must be an array." };
  }

  if (data.campaigns != null && !Array.isArray(data.campaigns)) {
    return { ok: false, error: "campaigns must be an array." };
  }

  if (data.settings != null && (typeof data.settings !== "object" || Array.isArray(data.settings))) {
    return { ok: false, error: "settings must be an object." };
  }

  const accounts = Array.isArray(data.accounts) ? data.accounts : [];
  const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];

  const badAccount = accounts.find((item) => !item || typeof item !== "object");
  if (badAccount) {
    return { ok: false, error: "One or more accounts are malformed." };
  }

  const badCampaign = campaigns.find((item) => !item || typeof item !== "object");
  if (badCampaign) {
    return { ok: false, error: "One or more campaigns are malformed." };
  }

  return { ok: true, data };
}

export function importBackup(data) {
  const check = validateBackup(data);
  if (!check.ok) {
    return check;
  }

  const accounts = (data.accounts || []).map((account) => emptyAccount(stripSecrets(account)));
  const campaigns = migrateCampaigns(data.campaigns || []).map((campaign) => emptyCampaign(campaign));
  const settings = emptySettings(data.settings || {});
  const content = data.content || [];
  const inbox = data.inbox || [];
  const analytics = data.analytics || [];
  const queue = data.queue || [];
  const decisions = data.decisions || [];
  const activity = data.activity || [];

  const wrote = replaceAll({
    [STORAGE_KEYS.accounts]: accounts,
    [STORAGE_KEYS.campaigns]: campaigns,
    [STORAGE_KEYS.settings]: settings,
    [STORAGE_KEYS.content]: content,
    [STORAGE_KEYS.inbox]: inbox,
    [STORAGE_KEYS.analytics]: analytics,
    [STORAGE_KEYS.queue]: queue,
    [STORAGE_KEYS.decisions]: decisions,
    [STORAGE_KEYS.activity]: activity,
    [STORAGE_KEYS.schemaVersion]: SCHEMA_VERSION,
    [STORAGE_KEYS.activeCampaignId]: data.activeCampaignId || campaigns[0]?.id || null,
  });

  if (!wrote) {
    return { ok: false, error: "Could not write backup to local storage." };
  }

  replaceAccounts(accounts);
  replaceCampaigns(campaigns);
  replaceSettings(settings);
  replaceContent(content);
  replaceInbox(inbox);
  replaceSnapshots(analytics);
  replaceQueue(queue);
  replaceDecisions(decisions);
  replaceActivity(activity);
  if (data.activeCampaignId) {
    setActiveCampaignId(data.activeCampaignId);
  }

  return {
    ok: true,
    imported: {
      accounts: accounts.length,
      campaigns: campaigns.length,
    },
  };
}

export function downloadBackupFile() {
  const backup = exportBackup();
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const stamp = new Date().toISOString().slice(0, 10);
  const link = document.createElement("a");
  link.href = url;
  link.download = `regeneluxe-backup-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return backup;
}

export { readString };
