import { describe, expect, it } from "vitest";
import { DomainSchemas, safeParseDomain } from "./domainSchemas.ts";

describe("domain schemas", () => {
  it("exports all required domain entities", () => {
    const names = [
      "Campaign",
      "SocialAccount",
      "CampaignStrategy",
      "ContentItem",
      "ContentVariant",
      "ScheduledPublication",
      "PublicationAttempt",
      "MetricSnapshot",
      "SocialInteraction",
      "CampaignStateSnapshot",
      "CampaignChange",
      "CampaignDecision",
      "CampaignExperiment",
      "CampaignResult",
      "AttentionItem",
      "Approval",
      "CampaignBrainRun",
      "CampaignMonitorRun",
      "Job",
      "AppSettings",
    ];
    for (const name of names) {
      expect(DomainSchemas[name]).toBeTruthy();
    }
  });

  it("accepts a campaign with stable ids and timestamps", () => {
    const parsed = safeParseDomain("Campaign", {
      id: "cmp_1",
      name: "Launch",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      schemaVersion: 1,
    });
    expect(parsed.success).toBe(true);
  });

  it("requires idempotency key on publication attempts", () => {
    const parsed = safeParseDomain("PublicationAttempt", {
      id: "att_1",
      contentId: "cnt_1",
      state: "DONE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});
