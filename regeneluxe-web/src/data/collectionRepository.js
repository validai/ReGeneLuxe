import { emptyContentItem, emptyInteraction, emptySnapshot, emptyQueueJob, emptyDecision, emptyActivity, mapAssetStatus } from "./domain.js";
import { listCampaigns } from "./campaignRepository.js";
import { STORAGE_KEYS } from "./storage.js";
import { nowIso } from "./ids.js";
import { recordEvent } from "./events.js";
import {
  bridgeList,
  bridgeUpsert,
  bridgeRemove,
  bridgeReplaceAll,
  isSqliteAuthority,
} from "./repoBridge.js";
import { filterByActiveProfile, stampProfile } from "./profileScope.js";

const KEY_MAP = {
  content: STORAGE_KEYS.content,
  inbox: STORAGE_KEYS.inbox,
  analytics: STORAGE_KEYS.analytics,
  queue: STORAGE_KEYS.queue,
  decisions: STORAGE_KEYS.decisions,
  activity: STORAGE_KEYS.activity,
};

function upsert(collection, storageKey, factory, item) {
  const record = factory(stampProfile({ ...item, updatedAt: nowIso() }));
  if (isSqliteAuthority()) {
    return bridgeUpsert(collection, storageKey, record);
  }
  const list = bridgeList(collection, storageKey, []);
  const index = list.findIndex((entry) => entry.id === record.id);
  if (index === -1) list.unshift(record);
  else list[index] = { ...list[index], ...record, updatedAt: nowIso() };
  bridgeReplaceAll(collection, storageKey, list);
  return record;
}

export function listContent(options = {}) {
  const existing = filterByActiveProfile(bridgeList("content", KEY_MAP.content, []), options);
  if (existing.length) return existing.map((item) => emptyContentItem(item));

  if (isSqliteAuthority()) return [];

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
  if (migrated.length) bridgeReplaceAll("content", KEY_MAP.content, migrated);
  return migrated;
}

export function getContent(id) {
  return listContent().find((item) => item.id === id) || null;
}

export function saveContent(partial) {
  return upsert("content", KEY_MAP.content, emptyContentItem, partial);
}

export function deleteContent(id) {
  return bridgeRemove("content", KEY_MAP.content, id);
}

export function replaceContent(list) {
  return bridgeReplaceAll("content", KEY_MAP.content, Array.isArray(list) ? list.map((item) => emptyContentItem(item)) : []);
}

export function listInbox(options = {}) {
  return filterByActiveProfile(bridgeList("inbox", KEY_MAP.inbox, []), options).map((item) => emptyInteraction(item));
}

export function saveInteraction(partial) {
  return upsert("inbox", KEY_MAP.inbox, emptyInteraction, partial);
}

export function replaceInbox(list) {
  return bridgeReplaceAll("inbox", KEY_MAP.inbox, Array.isArray(list) ? list.map((item) => emptyInteraction(item)) : []);
}

export function listSnapshots(options = {}) {
  return filterByActiveProfile(bridgeList("analytics", KEY_MAP.analytics, []), options).map((item) => emptySnapshot(item));
}

export function saveSnapshot(partial) {
  const metrics = { ...(partial.metrics || {}) };
  Object.keys(metrics).forEach((key) => {
    if (metrics[key] === 0 && partial.source !== "MANUAL" && partial.source !== "CALCULATED" && partial.source !== "PROVIDER") {
      metrics[key] = null;
    }
  });
  const next = upsert("analytics", KEY_MAP.analytics, emptySnapshot, { ...partial, metrics });
  recordEvent("ANALYTICS_REFRESHED", {
    campaignId: next.campaignId,
    accountId: next.accountId,
    contentId: next.contentId,
    message: "Metrics recorded",
  });
  return next;
}

export function replaceSnapshots(list) {
  return bridgeReplaceAll("analytics", KEY_MAP.analytics, Array.isArray(list) ? list.map((item) => emptySnapshot(item)) : []);
}

export function listQueue(options = {}) {
  return filterByActiveProfile(bridgeList("queue", KEY_MAP.queue, []), options).map((item) => emptyQueueJob(item));
}

export function saveQueueJob(partial) {
  return upsert("queue", KEY_MAP.queue, emptyQueueJob, partial);
}

export function replaceQueue(list) {
  return bridgeReplaceAll("queue", KEY_MAP.queue, Array.isArray(list) ? list.map((item) => emptyQueueJob(item)) : []);
}

export function listDecisions(options = {}) {
  return filterByActiveProfile(bridgeList("decisions", KEY_MAP.decisions, []), options).map((item) => emptyDecision(item));
}

export function saveDecision(partial) {
  return upsert("decisions", KEY_MAP.decisions, emptyDecision, partial);
}

export function replaceDecisions(list) {
  return bridgeReplaceAll("decisions", KEY_MAP.decisions, Array.isArray(list) ? list.map((item) => emptyDecision(item)) : []);
}

export function listActivity(campaignId, options = {}) {
  const all = filterByActiveProfile(bridgeList("activity", KEY_MAP.activity, []), options).map((item) => emptyActivity(item));
  return campaignId ? all.filter((item) => item.campaignId === campaignId) : all;
}

export function saveActivity(partial) {
  return upsert("activity", KEY_MAP.activity, emptyActivity, partial);
}

export function replaceActivity(list) {
  return bridgeReplaceAll("activity", KEY_MAP.activity, Array.isArray(list) ? list.map((item) => emptyActivity(item)) : []);
}

export function resetCollections() {
  bridgeReplaceAll("content", KEY_MAP.content, []);
  bridgeReplaceAll("inbox", KEY_MAP.inbox, []);
  bridgeReplaceAll("analytics", KEY_MAP.analytics, []);
  bridgeReplaceAll("queue", KEY_MAP.queue, []);
  bridgeReplaceAll("decisions", KEY_MAP.decisions, []);
  bridgeReplaceAll("activity", KEY_MAP.activity, []);
}
