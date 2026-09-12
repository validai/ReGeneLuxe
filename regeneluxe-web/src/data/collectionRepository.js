import { emptyContentItem, emptyInteraction, emptySnapshot, emptyQueueJob, emptyDecision, emptyActivity, mapAssetStatus } from "./domain.js";
import { listCampaigns } from "./campaignRepository.js";
import { readJson, writeJson, STORAGE_KEYS } from "./storage.js";
import { nowIso } from "./ids.js";
import { recordEvent } from "./events.js";

function store(key, fallback = []) {
  const raw = readJson(key, fallback);
  return Array.isArray(raw) ? raw : [];
}

function persist(key, list) {
  return writeJson(key, list);
}

function upsert(key, factory, item) {
  const list = store(key);
  const record = factory(item);
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index === -1) list.unshift(record);
  else list[index] = { ...list[index], ...record, updatedAt: nowIso() };
  persist(key, list);
  return record;
}

function remove(key, id) {
  persist(key, store(key).filter((item) => item.id !== id));
  return true;
}

export function listContent() {
  const existing = store(STORAGE_KEYS.content);
  if (existing.length) return existing.map((item) => emptyContentItem(item));

  const migrated = [];
  listCampaigns().forEach((campaign) => {
    (campaign.assets || []).forEach((asset) => {
      migrated.push(emptyContentItem({
        id: asset.id,
        campaignId: campaign.id,
        title: asset.name,
        format: asset.contentType,
        caption: asset.messageAngle,
        cta: asset.cta,
        accountIds: asset.accountId ? [asset.accountId] : [],
        status: mapAssetStatus(asset.status),
        scheduledAt: asset.plannedPublishDate,
        publishedAt: asset.actualPublishDate,
        notes: asset.notes,
        provenance: "MIGRATED",
      }));
    });
  });
  if (migrated.length) persist(STORAGE_KEYS.content, migrated);
  return migrated;
}

export function getContent(id) {
  return listContent().find((item) => item.id === id) || null;
}

export function saveContent(partial) {
  return upsert(STORAGE_KEYS.content, emptyContentItem, partial);
}

export function deleteContent(id) {
  return remove(STORAGE_KEYS.content, id);
}

export function replaceContent(list) {
  return persist(STORAGE_KEYS.content, Array.isArray(list) ? list.map((item) => emptyContentItem(item)) : []);
}

export function listInbox() {
  return store(STORAGE_KEYS.inbox).map((item) => emptyInteraction(item));
}

export function saveInteraction(partial) {
  return upsert(STORAGE_KEYS.inbox, emptyInteraction, partial);
}

export function replaceInbox(list) {
  return persist(STORAGE_KEYS.inbox, Array.isArray(list) ? list.map((item) => emptyInteraction(item)) : []);
}

export function listSnapshots() {
  return store(STORAGE_KEYS.analytics).map((item) => emptySnapshot(item));
}

export function saveSnapshot(partial) {
  const metrics = { ...(partial.metrics || {}) };
  Object.keys(metrics).forEach((key) => {
    if (metrics[key] === 0 && partial.source !== "MANUAL" && partial.source !== "CALCULATED" && partial.source !== "PROVIDER") {
      metrics[key] = null;
    }
  });
  const next = upsert(STORAGE_KEYS.analytics, emptySnapshot, { ...partial, metrics });
  recordEvent("ANALYTICS_REFRESHED", {
    campaignId: next.campaignId,
    accountId: next.accountId,
    contentId: next.contentId,
    message: "Metrics recorded",
  });
  return next;
}

export function replaceSnapshots(list) {
  return persist(STORAGE_KEYS.analytics, Array.isArray(list) ? list.map((item) => emptySnapshot(item)) : []);
}

export function listQueue() {
  return store(STORAGE_KEYS.queue).map((item) => emptyQueueJob(item));
}

export function saveQueueJob(partial) {
  return upsert(STORAGE_KEYS.queue, emptyQueueJob, partial);
}

export function replaceQueue(list) {
  return persist(STORAGE_KEYS.queue, Array.isArray(list) ? list.map((item) => emptyQueueJob(item)) : []);
}

export function listDecisions() {
  return store(STORAGE_KEYS.decisions).map((item) => emptyDecision(item));
}

export function saveDecision(partial) {
  return upsert(STORAGE_KEYS.decisions, emptyDecision, partial);
}

export function replaceDecisions(list) {
  return persist(STORAGE_KEYS.decisions, Array.isArray(list) ? list.map((item) => emptyDecision(item)) : []);
}

export function listActivity(campaignId) {
  const all = store(STORAGE_KEYS.activity).map((item) => emptyActivity(item));
  return campaignId ? all.filter((item) => item.campaignId === campaignId) : all;
}

export function saveActivity(partial) {
  return upsert(STORAGE_KEYS.activity, emptyActivity, partial);
}

export function replaceActivity(list) {
  return persist(STORAGE_KEYS.activity, Array.isArray(list) ? list.map((item) => emptyActivity(item)) : []);
}

export function resetCollections() {
  persist(STORAGE_KEYS.content, []);
  persist(STORAGE_KEYS.inbox, []);
  persist(STORAGE_KEYS.analytics, []);
  persist(STORAGE_KEYS.queue, []);
  persist(STORAGE_KEYS.decisions, []);
  persist(STORAGE_KEYS.activity, []);
}
