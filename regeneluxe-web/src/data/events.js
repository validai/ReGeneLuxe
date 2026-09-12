import { createId, nowIso } from "./ids.js";
import { readJson, writeJson, STORAGE_KEYS } from "./storage.js";

export const EVENT_TYPES = [
  "CAMPAIGN_CREATED",
  "CAMPAIGN_UPDATED",
  "ACCOUNT_CONNECTED",
  "ACCOUNT_DISCONNECTED",
  "CONNECTION_EXPIRED",
  "CONTENT_CREATED",
  "CONTENT_CHANGED",
  "CONTENT_APPROVED",
  "CONTENT_SCHEDULED",
  "CONTENT_PUBLISHED",
  "PUBLISH_FAILED",
  "ANALYTICS_REFRESHED",
  "METRIC_CHANGED",
  "PERFORMANCE_SPIKE",
  "PERFORMANCE_DROP",
  "INBOX_ACTIVITY",
  "EXPERIMENT_STARTED",
  "EXPERIMENT_MATURED",
  "RESULT_RECORDED",
  "USER_OVERRIDE",
  "AI_DECISION_APPLIED",
];

function storeEvents() {
  const raw = readJson(STORAGE_KEYS.events, []);
  return Array.isArray(raw) ? raw : [];
}

export function recordEvent(type, payload = {}) {
  if (!EVENT_TYPES.includes(type)) return null;
  const event = {
    id: createId("evt"),
    type,
    timestamp: nowIso(),
    campaignId: payload.campaignId || "",
    accountId: payload.accountId || "",
    contentId: payload.contentId || "",
    message: payload.message || "",
    meta: payload.meta || {},
  };
  const list = storeEvents();
  list.unshift(event);
  writeJson(STORAGE_KEYS.events, list.slice(0, 500));
  return event;
}

export function listEvents(filters = {}) {
  return storeEvents().filter((event) => {
    if (filters.campaignId && event.campaignId !== filters.campaignId) return false;
    if (filters.type && event.type !== filters.type) return false;
    return true;
  });
}
