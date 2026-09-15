import { SCHEMA_VERSION, emptySettings } from "./models.js";
import { STORAGE_KEYS, writeJson, removeKey } from "./storage.js";
import { resetCollections } from "./collectionRepository.js";
import {
  bridgeGetSettings,
  bridgeSaveSettings,
  bridgeReplaceAll,
  bridgeClearMeta,
  isSqliteAuthority,
} from "./repoBridge.js";
import { resetOperationalStore, setOperationalPrimary } from "./operationalStore.js";
import { queuePersistRecord } from "./dataClient.js";

export function getSettings() {
  return bridgeGetSettings(STORAGE_KEYS.settings, emptySettings);
}

export function updateSettings(patch) {
  const next = emptySettings({ ...getSettings(), ...patch, schemaVersion: SCHEMA_VERSION });
  return bridgeSaveSettings(STORAGE_KEYS.settings, next);
}

export function replaceSettings(settings) {
  const next = emptySettings(settings || {});
  return bridgeSaveSettings(STORAGE_KEYS.settings, next);
}

export function applyTheme(theme = "dark") {
  if (typeof document === "undefined") return "dark";
  const resolved = theme === "system"
    ? (window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark")
    : (theme === "light" ? "light" : "dark");
  document.documentElement.dataset.theme = resolved;
  document.documentElement.style.colorScheme = resolved;
  return resolved;
}

export function resetAllLocalData() {
  if (isSqliteAuthority()) {
    bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, []);
    bridgeReplaceAll("accounts", STORAGE_KEYS.accounts, []);
    bridgeReplaceAll("settings", STORAGE_KEYS.settings, [emptySettings({ id: "app" })]);
    resetCollections();
    bridgeClearMeta("active_campaign_id", STORAGE_KEYS.activeCampaignId);
    queuePersistRecord("settings", emptySettings({ id: "app" }));
    // Clear operational store locally; DB wipe is best-effort via empty replaces above.
    return true;
  }
  writeJson(STORAGE_KEYS.campaigns, []);
  writeJson(STORAGE_KEYS.accounts, []);
  writeJson(STORAGE_KEYS.settings, emptySettings());
  writeJson(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
  removeKey(STORAGE_KEYS.activeCampaignId);
  resetCollections();
  resetOperationalStore();
  setOperationalPrimary(false);
  return true;
}
