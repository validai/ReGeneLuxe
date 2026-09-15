import { emptyCampaign, mergeIntake, nowIso } from "./models.js";
import { markSchemaCurrent, migrateCampaigns, needsCampaignMigration } from "./migrate.js";
import { STORAGE_KEYS } from "./storage.js";
import { recordEvent } from "./events.js";
import {
  bridgeList,
  bridgeUpsert,
  bridgeRemove,
  bridgeReplaceAll,
  bridgeGetMeta,
  bridgeSetMeta,
  isSqliteAuthority,
} from "./repoBridge.js";
import { filterByActiveProfile, stampProfile } from "./profileScope.js";

function loadList() {
  return bridgeList("campaigns", STORAGE_KEYS.campaigns, []);
}

export function listCampaigns(options = {}) {
  const raw = loadList();
  if (!Array.isArray(raw)) return [];

  if (!isSqliteAuthority() && needsCampaignMigration(raw)) {
    const migrated = migrateCampaigns(raw);
    bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, migrated);
    markSchemaCurrent();
    return filterByActiveProfile(migrated, options);
  }

  return filterByActiveProfile(raw, options);
}

export function getCampaign(id) {
  if (!id) return null;
  return listCampaigns().find((campaign) => campaign.id === id) || null;
}

export function saveCampaigns(campaigns) {
  return bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, campaigns);
}

export function createCampaign(partial = {}) {
  const campaign = emptyCampaign(stampProfile(partial));
  if (isSqliteAuthority()) {
    bridgeUpsert("campaigns", STORAGE_KEYS.campaigns, campaign);
  } else {
    const campaigns = listCampaigns();
    campaigns.unshift(campaign);
    bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, campaigns);
  }
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
  if (isSqliteAuthority()) {
    bridgeUpsert("campaigns", STORAGE_KEYS.campaigns, next);
  } else {
    bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, campaigns);
  }
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
  bridgeRemove("campaigns", STORAGE_KEYS.campaigns, id);
  if (getActiveCampaignId() === id) {
    setActiveCampaignId(listCampaigns()[0]?.id || null);
  }
  return true;
}

export function getActiveCampaignId() {
  return bridgeGetMeta("active_campaign_id", STORAGE_KEYS.activeCampaignId);
}

export function setActiveCampaignId(id) {
  return bridgeSetMeta("active_campaign_id", STORAGE_KEYS.activeCampaignId, id || null);
}

export function getActiveCampaign() {
  const id = getActiveCampaignId();
  if (!id) return null;
  return getCampaign(id);
}

export function replaceCampaigns(campaigns) {
  return bridgeReplaceAll("campaigns", STORAGE_KEYS.campaigns, Array.isArray(campaigns) ? campaigns : []);
}
