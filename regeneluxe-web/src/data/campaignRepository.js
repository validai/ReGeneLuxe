import { emptyCampaign, mergeIntake, nowIso } from "./models.js";
import { markSchemaCurrent, migrateCampaigns, needsCampaignMigration } from "./migrate.js";
import { readJson, writeJson, readString, writeString, STORAGE_KEYS } from "./storage.js";
import { recordEvent } from "./events.js";

function loadRaw() {
  return readJson(STORAGE_KEYS.campaigns, []);
}

function persist(campaigns) {
  return writeJson(STORAGE_KEYS.campaigns, campaigns);
}

export function listCampaigns() {
  const raw = loadRaw();
  if (!Array.isArray(raw)) return [];

  if (needsCampaignMigration(raw)) {
    const migrated = migrateCampaigns(raw);
    persist(migrated);
    markSchemaCurrent();
    return migrated;
  }

  return raw;
}

export function getCampaign(id) {
  if (!id) return null;
  return listCampaigns().find((campaign) => campaign.id === id) || null;
}

export function saveCampaigns(campaigns) {
  return persist(campaigns);
}

export function createCampaign(partial = {}) {
  const campaign = emptyCampaign(partial);
  const campaigns = listCampaigns();
  campaigns.unshift(campaign);
  persist(campaigns);
  setActiveCampaignId(campaign.id);
  recordEvent("CAMPAIGN_CREATED", {
    campaignId: campaign.id,
    message: `Created campaign “${campaign.name}”`,
  });
  return campaign;
}

export function updateCampaign(id, patch) {
  const campaigns = listCampaigns();
  const index = campaigns.findIndex((campaign) => campaign.id === id);
  if (index === -1) return null;

  const current = campaigns[index];
  const next = {
    ...current,
    ...patch,
    id: current.id,
    createdAt: current.createdAt,
    updatedAt: nowIso(),
    intake: patch.intake ? mergeIntake(current.intake, patch.intake) : current.intake,
    blueprint: patch.blueprint
      ? {
          ...current.blueprint,
          ...patch.blueprint,
          creativeDirection: {
            ...(current.blueprint?.creativeDirection || {}),
            ...(patch.blueprint.creativeDirection || {}),
          },
        }
      : current.blueprint,
    iteration: patch.iteration ? { ...current.iteration, ...patch.iteration } : current.iteration,
    targeting: patch.targeting ? { ...current.targeting, ...patch.targeting } : current.targeting,
    accountIds: patch.accountIds !== undefined ? patch.accountIds : current.accountIds,
    assets: patch.assets !== undefined ? patch.assets : current.assets,
    results: patch.results !== undefined ? patch.results : current.results,
  };

  campaigns[index] = next;
  persist(campaigns);
  const meaningfulKeys = Object.keys(patch).filter((key) => key !== "currentSection" && key !== "updatedAt");
  if (meaningfulKeys.length) {
    recordEvent("CAMPAIGN_UPDATED", {
      campaignId: next.id,
      message: `Updated campaign “${next.name}”`,
    });
  }
  return next;
}

export function setCampaignActive(id, active) {
  return updateCampaign(id, { active: Boolean(active) });
}

export function deleteCampaign(id) {
  const campaigns = listCampaigns().filter((campaign) => campaign.id !== id);
  persist(campaigns);
  if (getActiveCampaignId() === id) {
    setActiveCampaignId(campaigns[0]?.id || null);
  }
  return true;
}

export function getActiveCampaignId() {
  return readString(STORAGE_KEYS.activeCampaignId);
}

export function setActiveCampaignId(id) {
  return writeString(STORAGE_KEYS.activeCampaignId, id || null);
}

export function getActiveCampaign() {
  const id = getActiveCampaignId();
  if (!id) return null;
  return getCampaign(id);
}

export function replaceCampaigns(campaigns) {
  return persist(Array.isArray(campaigns) ? campaigns : []);
}
