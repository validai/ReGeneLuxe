import { describe, expect, it } from "vitest";
import {
  migrateCampaignRecord,
  migrateAccountRecord,
  deriveActive,
  deriveCurrentSection,
  mapOnboardingToIntake,
  campaignNeedsMigration,
} from "./migrate.js";
import { SCHEMA_VERSION } from "./models.js";

describe("mapOnboardingToIntake", () => {
  it("maps useful onboarding fields into structured intake", () => {
    const intake = mapOnboardingToIntake({
      company: "Northstar",
      website: "https://example.com",
      objective: "Grow streams",
      idealCustomer: "Listeners 18-34",
      offer: "New single",
      budget: "$0",
      timeline: "2 weeks",
      caseProof: "old site",
      workEmail: "client@brand.com",
    });

    expect(intake.objective).toBe("Grow streams");
    expect(intake.offer).toBe("New single");
    expect(intake.audience.interestTags).toContain("Listeners 18-34");
    expect(intake.projectContext).toContain("Northstar");
    expect(intake.notes).toContain("old site");
    expect(intake).not.toHaveProperty("workEmail");
  });
});

describe("status and section migration", () => {
  it("maps working statuses to active and completed/archived to inactive", () => {
    expect(deriveActive({ status: "DRAFT" })).toBe(true);
    expect(deriveActive({ status: "READY" })).toBe(true);
    expect(deriveActive({ status: "ACTIVE" })).toBe(true);
    expect(deriveActive({ status: "PAUSED" })).toBe(true);
    expect(deriveActive({ status: "COMPLETED" })).toBe(false);
    expect(deriveActive({ status: "ARCHIVED" })).toBe(false);
    expect(deriveActive({ active: false, status: "DRAFT" })).toBe(false);
  });

  it("maps legacy stage onto currentSection", () => {
    expect(deriveCurrentSection({ currentSection: "CONTENT" })).toBe("CONTENT");
    expect(deriveCurrentSection({ currentSection: "RESULTS" })).toBe("RESULTS");
    expect(deriveCurrentSection({ currentSection: "BLUEPRINT" })).toBe("STRATEGY");
    expect(deriveCurrentSection({ stage: "ASSET_PLANNING" })).toBe("CONTENT");
    expect(deriveCurrentSection({ stage: "READY_TO_LAUNCH" })).toBe("CONTENT");
    expect(deriveCurrentSection({ stage: "RESULTS" })).toBe("ANALYTICS");
    expect(deriveCurrentSection({ stage: "ITERATION" })).toBe("RESULTS");
    expect(deriveCurrentSection({ results: [{ id: "1" }] })).toBe("ANALYTICS");
    expect(deriveCurrentSection({ iteration: { whatWorked: "hooks" } })).toBe("RESULTS");
  });
});

describe("migrateCampaignRecord", () => {
  it("preserves id/timestamps, drops tier and status, and converts onboarding", () => {
    const migrated = migrateCampaignRecord({
      id: "cmp_keep",
      name: "Spring drop",
      status: "DRAFT",
      stage: "BLUEPRINT",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      tierId: "presidential",
      onboarding: {
        campaignName: "Spring drop",
        objective: "Awareness",
        offer: "EP",
      },
      blueprint: {
        objective: "Awareness",
        audience: "Fans",
        creativeDirection: { tone: "Calm" },
      },
    });

    expect(migrated.id).toBe("cmp_keep");
    expect(migrated.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(migrated.active).toBe(true);
    expect(migrated.currentSection).toBe("STRATEGY");
    expect(migrated.status).toBeUndefined();
    expect(migrated.stage).toBeUndefined();
    expect(migrated.intake.objective).toBe("Awareness");
    expect(migrated.blueprint.objective).toBe("Awareness");
    expect(migrated.blueprint.creativeDirection.tone).toBe("Calm");
    expect(migrated.tierId).toBeUndefined();
    expect(migrated.onboarding).toBeUndefined();
    expect(campaignNeedsMigration(migrated)).toBe(false);
  });

  it("is idempotent", () => {
    const first = migrateCampaignRecord({
      id: "cmp_once",
      name: "Repeat",
      status: "PAUSED",
      stage: "INTAKE",
      intake: { goals: ["awareness"], promoted: { title: "Single" } },
    });
    const second = migrateCampaignRecord(first);
    expect(second.active).toBe(first.active);
    expect(second.currentSection).toBe(first.currentSection);
    expect(second.intake.goals).toEqual(["awareness"]);
  });

  it("migrates archived campaigns to inactive", () => {
    const migrated = migrateCampaignRecord({
      id: "cmp_old",
      name: "Done",
      status: "ARCHIVED",
      stage: "COMPLETE",
    });
    expect(migrated.active).toBe(false);
    expect(migrated.currentSection).toBe("RESULTS");
  });

  it("recovers from a malformed record without throwing", () => {
    const migrated = migrateCampaignRecord(null);
    expect(migrated.name).toBe("Recovered campaign");
    expect(migrated.id).toBeTruthy();
    expect(migrated.active).toBe(true);
  });
});

describe("migrateAccountRecord", () => {
  it("converts legacy status strings to active boolean", () => {
    expect(migrateAccountRecord({ id: "a1", status: "inactive", displayName: "Old" }).active).toBe(false);
    expect(migrateAccountRecord({ id: "a2", status: "active", displayName: "Live" }).active).toBe(true);
    expect(migrateAccountRecord({ id: "a3", active: false, status: "active" }).active).toBe(false);
  });
});

describe("schema version", () => {
  it("is version 4", () => {
    expect(SCHEMA_VERSION).toBe(4);
  });
});
