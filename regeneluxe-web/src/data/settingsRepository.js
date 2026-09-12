import { SCHEMA_VERSION, emptySettings } from "./models.js";
import { readJson, writeJson, removeKey, STORAGE_KEYS } from "./storage.js";
import { resetCollections } from "./collectionRepository.js";

export function getSettings() {
  const raw = readJson(STORAGE_KEYS.settings, null);
  if (!raw || typeof raw !== "object") {
    return emptySettings();
  }
  return emptySettings(raw);
}

export function updateSettings(patch) {
  const next = emptySettings({ ...getSettings(), ...patch, schemaVersion: SCHEMA_VERSION });
  writeJson(STORAGE_KEYS.settings, next);
  return next;
}

export function replaceSettings(settings) {
  const next = emptySettings(settings || {});
  writeJson(STORAGE_KEYS.settings, next);
  return next;
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
  writeJson(STORAGE_KEYS.campaigns, []);
  writeJson(STORAGE_KEYS.accounts, []);
  writeJson(STORAGE_KEYS.settings, emptySettings());
  writeJson(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
  removeKey(STORAGE_KEYS.activeCampaignId);
  resetCollections();
  return true;
}
