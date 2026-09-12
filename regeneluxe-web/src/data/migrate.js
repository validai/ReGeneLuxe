import {
  SCHEMA_VERSION,
  CURRENT_SECTIONS,
  emptyCampaign,
  emptyIntake,
  emptyBlueprint,
  emptyCreativeDirection,
  emptyIteration,
  emptyAccount,
  mergeIntake,
  intakeHasContent,
  blueprintHasContent,
  iterationHasContent,
  hasText,
} from "./models.js";
import { readJson, writeJson, STORAGE_KEYS } from "./storage.js";
import { LEGACY_SECTION_MAP } from "./domain.js";

const INACTIVE_STATUSES = new Set(["COMPLETED", "ARCHIVED", "completed", "archived"]);

const SECTION_MAP = LEGACY_SECTION_MAP;

export function deriveActive(raw) {
  if (!raw || typeof raw !== "object") return true;
  if (typeof raw.active === "boolean") return raw.active;
  const status = raw.status;
  if (status == null) return true;
  if (INACTIVE_STATUSES.has(status) || INACTIVE_STATUSES.has(String(status).toUpperCase())) {
    return false;
  }
  return true;
}

export function deriveCurrentSection(raw) {
  const section = raw?.currentSection;
  const legacyRecord = Boolean(raw?.stage || raw?.status);
  if (section && CURRENT_SECTIONS.includes(section) && !(section === "RESULTS" && legacyRecord)) {
    return section;
  }
  if (section && SECTION_MAP[section]) return SECTION_MAP[section];
  if (raw?.stage && SECTION_MAP[raw.stage]) return SECTION_MAP[raw.stage];
  if (iterationHasContent(raw?.iteration)) return "RESULTS";
  if (Array.isArray(raw?.results) && raw.results.length > 0) return "ANALYTICS";
  if (Array.isArray(raw?.assets) && raw.assets.length > 0) return "CONTENT";
  if (blueprintHasContent(raw?.blueprint) || intakeHasContent(raw?.intake)) return "STRATEGY";
  return "OVERVIEW";
}

function mapLegacyTextIntake(rawIntake = {}, onboarding = {}) {
  const intake = emptyIntake();
  const objective = rawIntake.objective || onboarding.objective || onboarding.primaryObjective || "";
  const offer = rawIntake.offer || onboarding.offer || "";
  const audience = rawIntake.audience || onboarding.idealCustomer || "";
  const keyMessage = rawIntake.keyMessage || onboarding.keyMessage || "";
  const notes = [rawIntake.notes, rawIntake.constraints, rawIntake.successCriteria, rawIntake.availableAssets, onboarding.caseProof]
    .filter(hasText)
    .join("\n");
  const projectContext = [
    rawIntake.projectContext,
    onboarding.company,
    onboarding.website,
    onboarding.budget,
    onboarding.timeline,
  ].filter(hasText).join(" · ");

  intake.objective = objective;
  intake.offer = offer;
  intake.keyMessage = keyMessage;
  intake.projectContext = projectContext;
  intake.notes = notes;
  intake.accountIds = Array.isArray(rawIntake.accountIds) ? rawIntake.accountIds : [];
  intake.messaging = { ...intake.messaging, keyMessage };
  intake.promoted = {
    ...intake.promoted,
    title: offer,
    description: offer,
  };
  if (hasText(audience)) {
    intake.audience.interestTags = [audience];
  }
  intake.advanced = {
    ...intake.advanced,
    startDate: rawIntake.startDate || "",
    endDate: rawIntake.endDate || "",
    budget: onboarding.budget || rawIntake.budget || "",
    internalNotes: rawIntake.timing || "",
  };
  return intake;
}

function isStructuredIntake(intake) {
  return intake && typeof intake === "object" && Array.isArray(intake.goals);
}

export function migrateCampaignRecord(raw) {
  if (!raw || typeof raw !== "object") {
    return emptyCampaign({ name: "Recovered campaign" });
  }

  try {
    const intake = isStructuredIntake(raw.intake)
      ? mergeIntake(emptyIntake(), raw.intake)
      : mapLegacyTextIntake(raw.intake || {}, raw.onboarding || {});

    const blueprint = raw.blueprint && typeof raw.blueprint === "object"
      ? {
          ...emptyBlueprint(),
          ...raw.blueprint,
          creativeDirection: {
            ...emptyCreativeDirection(),
            ...(raw.blueprint.creativeDirection || {}),
          },
          edited: { ...(raw.blueprint.edited || {}) },
        }
      : emptyBlueprint();

    const migrated = emptyCampaign({
      id: raw.id,
      name: raw.name || raw.onboarding?.campaignName || intake.promoted?.title || "Untitled campaign",
      objective: raw.objective || intake.objective || "",
      active: deriveActive(raw),
      currentSection: deriveCurrentSection(raw),
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt || raw.createdAt,
      startDate: raw.startDate || intake.advanced?.startDate || "",
      endDate: raw.endDate || intake.advanced?.endDate || "",
      notes: raw.notes || intake.notes || "",
      accountIds: Array.isArray(raw.accountIds) ? raw.accountIds : intake.accountIds,
      intake,
      blueprint,
      assets: Array.isArray(raw.assets) ? raw.assets : [],
      results: Array.isArray(raw.results) ? raw.results : [],
      iteration: { ...emptyIteration(), ...(raw.iteration || {}) },
      targeting: raw.targeting,
      platforms: raw.platforms,
      website: raw.website || "",
      timezone: raw.timezone || "",
    });

    return migrated;
  } catch (error) {
    console.error("[migrate] campaign record failed", raw?.id, error);
    return emptyCampaign({
      id: raw.id,
      name: raw.name || "Recovered campaign",
      notes: "This campaign could not be fully migrated. Original id was preserved.",
    });
  }
}

export function migrateAccountRecord(raw) {
  if (!raw || typeof raw !== "object") return emptyAccount();
  return emptyAccount(raw);
}

export function migrateCampaigns(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      try {
        return migrateCampaignRecord(item);
      } catch (error) {
        console.error("[migrate] skipped malformed campaign", error);
        return null;
      }
    })
    .filter(Boolean);
}

export function campaignNeedsMigration(item) {
  if (!item || typeof item !== "object") return true;
  if (typeof item.active !== "boolean") return true;
  if (!CURRENT_SECTIONS.includes(item.currentSection)) return true;
  if (!isStructuredIntake(item.intake)) return true;
  if (item.status && ["DRAFT", "READY", "PAUSED", "COMPLETED", "ARCHIVED"].includes(item.status)) return true;
  return false;
}

export function needsCampaignMigration(list) {
  const storedVersion = Number(readJson(STORAGE_KEYS.schemaVersion, 0)) || 0;
  if (storedVersion < SCHEMA_VERSION) return true;
  if (!Array.isArray(list)) return false;
  return list.some(campaignNeedsMigration);
}

export function markSchemaCurrent() {
  writeJson(STORAGE_KEYS.schemaVersion, SCHEMA_VERSION);
}

export { SCHEMA_VERSION };

export function mapOnboardingToIntake(onboarding = {}) {
  return mapLegacyTextIntake({}, onboarding);
}
