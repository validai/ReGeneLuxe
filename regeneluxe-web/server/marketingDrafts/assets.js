import { initDb, list, COLLECTIONS } from "../db/index.js";
import { ASSET_STATES } from "./model.js";

function looksLikeFilesystemPath(value) {
  const raw = String(value || "");
  return raw.includes("/") || raw.includes("\\") || raw.startsWith("~") || /^[A-Za-z]:\\/.test(raw);
}

function normalizeAssetId(value) {
  if (value == null) return "";
  if (typeof value === "object") return String(value.id || value.mediaId || value.assetId || "").trim();
  return String(value).trim();
}

/**
 * Resolve ReGeneLuxe asset IDs only. Never returns filesystem paths.
 */
export async function resolveSafeAssets(mediaRefs = [], { workspaceId = null, campaignId = null } = {}) {
  await initDb();
  const ids = (Array.isArray(mediaRefs) ? mediaRefs : []).map(normalizeAssetId).filter(Boolean);
  if (!ids.length) return [];

  const campaigns = await list(COLLECTIONS.campaigns);
  const campaignAssets = [];
  for (const campaign of campaigns) {
    if (workspaceId && campaign.managedProfileId && campaign.managedProfileId !== workspaceId) continue;
    if (campaignId && campaign.id !== campaignId) continue;
    for (const asset of campaign.assets || []) {
      campaignAssets.push({
        ...asset,
        campaignId: campaign.id,
        workspaceId: campaign.managedProfileId || null,
      });
    }
  }

  const contentRows = (await list(COLLECTIONS.content)).filter((row) => {
    if (!workspaceId) return true;
    return row.managedProfileId === workspaceId || row.workspaceId === workspaceId;
  });

  return ids.map((id) => {
    if (looksLikeFilesystemPath(id)) {
      return {
        id: null,
        missing: true,
        rejected: true,
        reason: "FILESYSTEM_PATH_DENIED",
      };
    }
    const fromCampaign = campaignAssets.find((asset) => asset.id === id);
    if (fromCampaign) {
      return {
        id: fromCampaign.id,
        type: fromCampaign.contentType || "asset",
        title: fromCampaign.name || "",
        previewAvailable: Boolean(fromCampaign.sourceRef || fromCampaign.thumbnail),
        assetState: ASSET_STATES.includes(fromCampaign.assetState) ? fromCampaign.assetState : mapLegacyAssetState(fromCampaign.status),
        campaignId: fromCampaign.campaignId,
        version: fromCampaign.version || null,
        final: fromCampaign.assetState === "FINAL" || fromCampaign.status === "FINAL",
        approvedForCampaign: fromCampaign.assetState === "APPROVED_FOR_CAMPAIGN" || fromCampaign.status === "APPROVED",
        missing: false,
      };
    }
    const contentHit = contentRows.find((row) => row.id === id || (row.mediaRefs || []).includes(id));
    if (contentHit) {
      return {
        id,
        type: contentHit.contentType || contentHit.format || "content_ref",
        title: contentHit.title || "",
        previewAvailable: Boolean(contentHit.thumbnail || contentHit.imageUrl),
        assetState: "DRAFT_ASSET",
        campaignId: contentHit.campaignId || null,
        version: null,
        missing: false,
      };
    }
    // Allow opaque asset IDs that are not filesystem paths — agent may reference planned IDs.
    // Mark missing so create can reject unknown refs if desired; service rejects when missing=true.
    return {
      id,
      type: "unknown",
      title: "",
      previewAvailable: false,
      assetState: "DRAFT_ASSET",
      campaignId: campaignId || null,
      version: null,
      missing: true,
    };
  });
}

function mapLegacyAssetState(status) {
  const key = String(status || "").toUpperCase();
  if (key === "FINAL") return "FINAL";
  if (key === "APPROVED" || key === "READY") return "APPROVED_FOR_CAMPAIGN";
  return "DRAFT_ASSET";
}

export async function getSafeAssetMetadata(assetId, { workspaceId } = {}) {
  const [row] = await resolveSafeAssets([assetId], { workspaceId });
  return row || null;
}

export { looksLikeFilesystemPath };
