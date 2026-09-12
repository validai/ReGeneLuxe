const listeners = new Set();
let snapshotVersion = 0;

export const STORAGE_KEYS = {
  campaigns: "rl_campaigns_v1",
  accounts: "rl_accounts_v1",
  settings: "rl_settings_v1",
  activeCampaignId: "rl_active_campaign_id",
  schemaVersion: "rl_schema_version",
  content: "rl_content_v1",
  inbox: "rl_inbox_v1",
  analytics: "rl_analytics_v1",
  queue: "rl_queue_v1",
  decisions: "rl_decisions_v1",
  activity: "rl_activity_v1",
  events: "rl_events_v1",
  workingAccountId: "rl_working_account_id",
  campaignSnapshots: "rl_campaign_snapshots_v1",
};

export function hasStorage() {
  try {
    if (typeof window === "undefined") return false;
    const probe = "__rl_storage_probe__";
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshotVersion() {
  return snapshotVersion;
}

function notify() {
  snapshotVersion += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[storage] listener error", error);
    }
  });
}

export function readJson(key, fallback) {
  if (!hasStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.error("[storage] readJson failed", key, error);
    return fallback;
  }
}

export function writeJson(key, value) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    notify();
    return true;
  } catch (error) {
    console.error("[storage] writeJson failed", key, error);
    return false;
  }
}

export function readString(key) {
  if (!hasStorage()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error("[storage] readString failed", key, error);
    return null;
  }
}

export function writeString(key, value) {
  if (!hasStorage()) return false;
  try {
    if (value == null || value === "") {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
    notify();
    return true;
  } catch (error) {
    console.error("[storage] writeString failed", key, error);
    return false;
  }
}

export function removeKey(key) {
  if (!hasStorage()) return false;
  try {
    window.localStorage.removeItem(key);
    notify();
    return true;
  } catch (error) {
    console.error("[storage] removeKey failed", key, error);
    return false;
  }
}

export function replaceAll(entries) {
  if (!hasStorage()) return false;
  try {
    Object.entries(entries).forEach(([key, value]) => {
      if (value == null) {
        window.localStorage.removeItem(key);
      } else if (typeof value === "string") {
        window.localStorage.setItem(key, value);
      } else {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    });
    notify();
    return true;
  } catch (error) {
    console.error("[storage] replaceAll failed", error);
    return false;
  }
}
