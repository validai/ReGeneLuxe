/**
 * In-memory operational store — product SoT after SQLite bootstrap.
 * Test harness (Vitest) continues using localStorage via repositories.
 */

const listeners = new Set();
let version = 0;

/** @type {Record<string, unknown[] | Record<string, unknown>>} */
const collections = Object.create(null);

/** @type {Record<string, string | null>} */
const meta = Object.create(null);

let primary = false;

export function isOperationalPrimary() {
  return primary;
}

export function setOperationalPrimary(value) {
  primary = Boolean(value);
  notify();
}

export function subscribeOperational(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOperationalVersion() {
  return version;
}

function notify() {
  version += 1;
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.error("[operationalStore] listener error", error);
    }
  });
}

export function listCollection(name) {
  const rows = collections[name];
  return Array.isArray(rows) ? rows.slice() : [];
}

export function getCollectionItem(name, id) {
  return listCollection(name).find((row) => row?.id === id) || null;
}

export function replaceCollection(name, rows) {
  collections[name] = Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
  notify();
  return collections[name];
}

export function upsertCollectionItem(name, record) {
  if (!record?.id) throw new Error("upsertCollectionItem requires record.id");
  const list = listCollection(name);
  const index = list.findIndex((row) => row.id === record.id);
  const next = { ...record };
  if (index === -1) list.unshift(next);
  else list[index] = { ...list[index], ...next };
  collections[name] = list;
  notify();
  return next;
}

export function removeCollectionItem(name, id) {
  collections[name] = listCollection(name).filter((row) => row.id !== id);
  notify();
  return true;
}

export function getMetaValue(key) {
  return meta[key] ?? null;
}

export function setMetaValue(key, value) {
  meta[key] = value == null || value === "" ? null : String(value);
  notify();
  return meta[key];
}

/**
 * Load full snapshot from /api/data/snapshot into memory.
 */
export function hydrateFromSnapshot(data) {
  if (!data || typeof data !== "object") return;
  replaceCollection("campaigns", data.campaigns || []);
  replaceCollection("accounts", data.accounts || []);
  replaceCollection("content", data.content || []);
  replaceCollection("inbox", data.inbox || []);
  replaceCollection("analytics", data.analytics || []);
  replaceCollection("queue", data.queue || []);
  replaceCollection("decisions", data.decisions || []);
  replaceCollection("activity", data.activity || []);
  replaceCollection("events", data.events || []);
  replaceCollection("campaign_snapshots", normalizeSnapshots(data.campaignSnapshots || data.campaign_snapshots));
  replaceCollection("publication_attempts", data.publication_attempts || data.publicationAttempts || []);
  replaceCollection("experiments", data.experiments || []);

  const settings = data.settings && typeof data.settings === "object"
    ? [{ id: data.settings.id || "app", ...data.settings }]
    : [{ id: "app" }];
  replaceCollection("settings", settings);

  if (data.activeCampaignId != null) setMetaValue("active_campaign_id", data.activeCampaignId);
  if (data.workingAccountId != null) setMetaValue("working_account_id", data.workingAccountId);
  if (data.activeProfileId != null) setMetaValue("active_profile_id", data.activeProfileId);

  replaceCollection("operators", data.operators || []);
  replaceCollection("managed_profiles", data.managedProfiles || data.managed_profiles || []);
  replaceCollection("profile_connections", data.profileConnections || data.profile_connections || []);
}

function normalizeSnapshots(raw) {
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === "object") {
    return Object.entries(raw).map(([campaignId, payload]) => ({
      id: payload?.id || `snap_${campaignId}`,
      campaignId,
      ...(payload && typeof payload === "object" ? payload : { payload }),
    }));
  }
  return [];
}

export function getSettingsRecord() {
  return listCollection("settings")[0] || { id: "app" };
}

export function resetOperationalStore() {
  Object.keys(collections).forEach((key) => {
    collections[key] = [];
  });
  Object.keys(meta).forEach((key) => {
    delete meta[key];
  });
  primary = false;
  notify();
}

/** Test helper */
export function __debugOperationalState() {
  return { primary, version, collections: { ...collections }, meta: { ...meta } };
}
