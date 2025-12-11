// FILE: src/utils/campaignStore.js

const STORAGE_KEY = "rl_campaigns_v1";
const ACTIVE_KEY = "rl_active_campaign_id";

function safeParse(json, fallback) {
  try {
    return json ? JSON.parse(json) : fallback;
  } catch {
    return fallback;
  }
}

export function getAllCampaigns() {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(STORAGE_KEY), []);
}

export function saveAllCampaigns(campaigns) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(campaigns));
}

// Alias for consistency
export function saveCampaigns(campaigns) {
  saveAllCampaigns(campaigns);
}

export function getActiveCampaignId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}

export function setActiveCampaignId(id) {
  if (typeof window === "undefined") return;
  if (id) {
    window.localStorage.setItem(ACTIVE_KEY, id);
  } else {
    window.localStorage.removeItem(ACTIVE_KEY);
  }
}

export function getActiveCampaign() {
  const id = getActiveCampaignId();
  if (!id) return null;
  return getAllCampaigns().find(c => c.id === id) || null;
}

function genId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `cmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Create a campaign skeleton from onboarding answers.
 * onboardingData = whatever we collect on Start.jsx (brand, budget, objective, etc.)
 */
export function createCampaignFromOnboarding(onboardingData) {
  const now = new Date().toISOString();
  const campaigns = getAllCampaigns();

  const campaign = {
    id: genId(),
    // name can be refined later in Blueprint; start with a simple fallback
    name: onboardingData.campaignName || onboardingData.company || onboardingData.brandName || "Untitled campaign",
    status: "draft", // 'draft' | 'live' | 'paused' | 'completed'
    createdAt: now,
    updatedAt: now,
    tierId: null,
    onboarding: onboardingData,
    blueprint: null,
    // analytics placeholders – always numeric, default 0
    metrics: {
      views28d: 0,
      conversions28d: 0,
      blendedCpa: 0,
      healthScore: 0,
    },
    // Configuration fields
    targeting: {
      ageRange: { min: null, max: null },
      geoType: null,
      locations: [],
      interests: "",
      targetingStyle: null,
    },
    platforms: [],
    website: null,
    timezone: null,
    contactEmail: null,
    campaignLengthDays: null,
    startDate: null,
    endDate: null,
  };

  campaigns.push(campaign);
  saveAllCampaigns(campaigns);
  setActiveCampaignId(campaign.id);

  return campaign;
}

/**
 * Attach blueprint data to an existing campaign (by id) and optionally update the name + tier.
 */
export function attachBlueprintToCampaign(campaignId, { tierId, campaignName, blueprintData }) {
  const campaigns = getAllCampaigns();
  const idx = campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) return null;

  const prev = campaigns[idx];
  
  // Extract config fields from blueprintData
  const {
    targeting,
    platforms,
    website,
    timezone,
    contactEmail,
    campaignLengthDays,
    startDate,
    endDate,
    email, // map email to contactEmail if present
    ...restBlueprintData
  } = blueprintData || {};

  const next = {
    ...prev,
    tierId: tierId ?? prev.tierId,
    name: campaignName || prev.name,
    blueprint: {
      ...(prev.blueprint || {}),
      ...restBlueprintData,
    },
    // Merge targeting config
    targeting: {
      ...(prev.targeting || {}),
      ...(targeting || {}),
      ageRange: {
        ...(prev.targeting?.ageRange || {}),
        ...(targeting?.ageRange || {}),
      },
    },
    // Update platforms if provided
    platforms: platforms || prev.platforms || [],
    // Update other config fields
    website: website || prev.website || prev.onboarding?.website || null,
    timezone: timezone || prev.timezone || prev.onboarding?.timezone || null,
    contactEmail: contactEmail || email || prev.contactEmail || prev.onboarding?.workEmail || null,
    campaignLengthDays: campaignLengthDays || prev.campaignLengthDays || null,
    startDate: startDate || prev.startDate || null,
    endDate: endDate || prev.endDate || null,
    status: prev.status === "draft" ? "live" : prev.status, // simple default
    updatedAt: new Date().toISOString(),
  };

  campaigns[idx] = next;
  saveAllCampaigns(campaigns);
  setActiveCampaignId(next.id);
  return next;
}

/**
 * Update campaign configuration fields (targeting, platforms, website, etc.)
 */
export function updateCampaignConfig(campaignId, partialConfig) {
  const campaigns = getAllCampaigns();
  const idx = campaigns.findIndex(c => c.id === campaignId);
  if (idx === -1) return null;

  const existing = campaigns[idx];

  const updated = {
    ...existing,
    ...partialConfig,
    targeting: {
      ...(existing.targeting || {}),
      ...(partialConfig.targeting || {}),
      ageRange: {
        ...(existing.targeting?.ageRange || {}),
        ...(partialConfig.targeting?.ageRange || {}),
      },
    },
    platforms: partialConfig.platforms !== undefined ? partialConfig.platforms : (existing.platforms || []),
    updatedAt: new Date().toISOString(),
  };

  campaigns[idx] = updated;
  saveAllCampaigns(campaigns);
  return updated;
}

