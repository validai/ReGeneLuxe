/**
 * Bridge: repositories use SQLite-backed operational store in product,
 * localStorage in the Vitest harness.
 */
import { isTestHarness } from "./access";
import {
  isOperationalPrimary,
  listCollection,
  getCollectionItem,
  upsertCollectionItem,
  removeCollectionItem,
  replaceCollection,
  getMetaValue,
  setMetaValue,
  getSettingsRecord,
} from "./operationalStore.js";
import { queuePersistRecord, queueRemoveRecord, queueSetMeta } from "./dataClient.js";
import { readJson, writeJson, readString, writeString, removeKey } from "./storage.js";

export function isSqliteAuthority() {
  return isOperationalPrimary() && !isTestHarness();
}

export function bridgeList(collection, storageKey, fallback = []) {
  if (isSqliteAuthority()) return listCollection(collection);
  const raw = readJson(storageKey, fallback);
  return Array.isArray(raw) ? raw : fallback;
}

export function bridgeGet(collection, storageKey, id) {
  if (isSqliteAuthority()) return getCollectionItem(collection, id);
  const list = bridgeList(collection, storageKey, []);
  return list.find((item) => item?.id === id) || null;
}

export function bridgeUpsert(collection, storageKey, record, { replaceList = null } = {}) {
  if (isSqliteAuthority()) {
    const saved = upsertCollectionItem(collection, record);
    queuePersistRecord(collection, saved);
    return saved;
  }
  if (Array.isArray(replaceList)) {
    writeJson(storageKey, replaceList);
    return record;
  }
  const list = bridgeList(collection, storageKey, []);
  const index = list.findIndex((item) => item.id === record.id);
  if (index === -1) list.unshift(record);
  else list[index] = record;
  writeJson(storageKey, list);
  return record;
}

export function bridgeReplaceAll(collection, storageKey, records) {
  const list = Array.isArray(records) ? records : [];
  if (isSqliteAuthority()) {
    replaceCollection(collection, list);
    list.forEach((record) => {
      if (record?.id) queuePersistRecord(collection, record);
    });
    return list;
  }
  writeJson(storageKey, list);
  return list;
}

export function bridgeRemove(collection, storageKey, id) {
  if (isSqliteAuthority()) {
    removeCollectionItem(collection, id);
    queueRemoveRecord(collection, id);
    return true;
  }
  const list = bridgeList(collection, storageKey, []).filter((item) => item.id !== id);
  writeJson(storageKey, list);
  return true;
}

export function bridgeGetMeta(metaKey, storageKey) {
  if (isSqliteAuthority()) return getMetaValue(metaKey);
  return readString(storageKey);
}

export function bridgeSetMeta(metaKey, storageKey, value) {
  if (isSqliteAuthority()) {
    setMetaValue(metaKey, value);
    const payload = {};
    payload[metaKey] = value == null ? null : String(value);
    queueSetMeta(payload);
    return true;
  }
  return writeString(storageKey, value);
}

export function bridgeClearMeta(metaKey, storageKey) {
  if (isSqliteAuthority()) {
    setMetaValue(metaKey, null);
    const payload = {};
    payload[metaKey] = null;
    queueSetMeta(payload);
    return true;
  }
  return removeKey(storageKey);
}

export function bridgeGetSettings(storageKey, emptyFactory) {
  if (isSqliteAuthority()) {
    return emptyFactory(getSettingsRecord());
  }
  const raw = readJson(storageKey, null);
  if (!raw || typeof raw !== "object") return emptyFactory();
  return emptyFactory(raw);
}

export function bridgeSaveSettings(storageKey, settings) {
  const record = { id: settings.id || "app", ...settings };
  if (isSqliteAuthority()) {
    upsertCollectionItem("settings", record);
    queuePersistRecord("settings", record);
    return settings;
  }
  writeJson(storageKey, settings);
  return settings;
}

export { getSettingsRecord };
