import { describe, expect, it } from "vitest";
import { availableCapabilities, declaredCapabilities, hasCapability } from "./connectors/registry.js";
import { emptyAccount } from "./models.js";
import { emptyContentItem, emptyDecision } from "./domain.js";
import { validateCampaignPlan, sanitizeAiContext } from "./ai/validator.js";
import {
  applyPlan,
  buildStrategyPlan,
  analyzeCampaign,
  historicLessons,
  proposeIteration,
  proposeCoordination,
  canApplyAiPlan,
  canAutoSchedule,
} from "./ai/campaignBrain.js";
import { analyzeAccountChannel } from "./ai/channelIntelligence.js";
import { requestPublish, scheduleContent, markPublished } from "./publishing.js";
import { processQueueJob, confirmManualPublish, listQueueJobs } from "./queueService.js";
import { createCampaign } from "./campaignRepository.js";
import { createAccount } from "./accountRepository.js";
import { exportBackup } from "./backupService.js";
import { listContent, listQueue, saveSnapshot, saveDecision } from "./collectionRepository.js";

describe("connectors", () => {
  it("declares capabilities without making them available on manual accounts", () => {
    expect(declaredCapabilities("Instagram")).toContain("PUBLISH_POST");
    const account = emptyAccount({ platform: "Instagram", connectionState: "MANUAL_ONLY" });
    expect(availableCapabilities(account)).toEqual([]);
    expect(hasCapability(account, "PUBLISH_POST")).toBe(false);
  });

  it("only exposes capabilities when truly connected", () => {
    const account = emptyAccount({ platform: "YouTube", connectionState: "CONNECTED" });
    expect(hasCapability(account, "READ_PROFILE")).toBe(true);
  });

  it("does not declare publish capabilities for Snapchat, Twitch, or Kick", () => {
    for (const platform of ["Snapchat", "Twitch", "Kick"]) {
      expect(declaredCapabilities(platform)).toEqual([]);
      const account = emptyAccount({ platform, connectionState: "MANUAL_ONLY" });
      expect(availableCapabilities(account)).toEqual([]);
      expect(hasCapability(account, "PUBLISH_POST")).toBe(false);
      const connected = emptyAccount({ platform, connectionState: "CONNECTED" });
      expect(hasCapability(connected, "PUBLISH_POST")).toBe(false);
    }
  });
});

describe("content and publishing", () => {
  it("creates platform variants and schedules without faking publish", () => {
    const account = createAccount({ displayName: "DJ Coast", handle: "@djcoast", platform: "Instagram" });
    const campaign = createCampaign({ name: "Album", accountIds: [account.id] });
    const content = scheduleContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Teaser",
      accountIds: [account.id],
      variants: [{ platform: "Instagram", accountId: account.id, caption: "Listen" }],
    }), "2026-09-07T18:00");
    expect(content.status).toBe("SCHEDULED");
    const publish = requestPublish(content, account);
    expect(publish.manual).toBe(true);
    expect(publish.ok).toBe(false);
    const published = markPublished(content);
    expect(published.status).toBe("PUBLISHED");
    expect(listContent().some((item) => item.id === content.id)).toBe(true);
  });

  it("honors analyze-only permissions", () => {
    const account = emptyAccount({ publishPermission: "ANALYZE_ONLY", connectionState: "MANUAL_ONLY" });
    const result = requestPublish(emptyContentItem({ title: "Nope" }), account);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/analyze only/i);
  });

  it("creates queue jobs and requires manual confirmation", () => {
    const account = createAccount({ displayName: "DJ Coast", handle: "@djcoast", platform: "Instagram" });
    const campaign = createCampaign({ name: "Queue camp", accountIds: [account.id] });
    const content = scheduleContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Queued teaser",
      accountIds: [account.id],
    }), "2026-09-08T12:00");
    expect(listQueue().some((job) => job.contentId === content.id)).toBe(true);
    const job = listQueueJobs()[0];
    const processed = processQueueJob(job.id);
    expect(processed.manual).toBe(true);
    const confirmed = confirmManualPublish(job.id);
    expect(confirmed.ok).toBe(true);
    expect(confirmed.content.status).toBe("PUBLISHED");
  });
});

describe("campaign brain", () => {
  it("builds a strategy plan as calculated records, not AI", () => {
    const account = createAccount({ handle: "@djcoast", platform: "Instagram" });
    const campaign = createCampaign({
      name: "Teotihuacan",
      accountIds: [account.id],
      intake: { goals: ["release_promotion"], contentFormats: ["reel"], promoted: { title: "Teotihuacan" } },
    });
    const plan = buildStrategyPlan(campaign, [account]);
    expect(plan.source).toBe("CALCULATED");
    const created = applyPlan(plan, campaign);
    expect(created[0].provenance).toBe("CALCULATED");
    expect(created[0].variants[0].platform).toBe("Instagram");
  });

  it("does not invent analytics", () => {
    const campaign = createCampaign({ name: "Empty" });
    expect(analyzeCampaign(campaign, []).available).toBe(false);
    saveSnapshot({ campaignId: campaign.id, source: "MANUAL", metrics: { views: 12 } });
    expect(analyzeCampaign(campaign, []).available).toBe(true);
  });

  it("validates structured AI output and strips secrets", () => {
    expect(validateCampaignPlan({}).ok).toBe(false);
    expect(validateCampaignPlan({ objective: "Grow", contentIdeas: [], successMetrics: [] }).ok).toBe(true);
    const clean = sanitizeAiContext({ name: "A", apiKey: "secret", nested: { accessToken: "x" } });
    expect(clean.apiKey).toBeUndefined();
    expect(clean.nested.accessToken).toBeUndefined();
  });

  it("only stores historic lessons from recorded outcomes", () => {
    expect(historicLessons()).toEqual([]);
    const account = createAccount({ handle: "@learn", platform: "TikTok" });
    saveDecision(emptyDecision({
      affectedAccountIds: [account.id],
      actualOutcome: "Short clips beat covers",
      decision: "Prefer short clips",
    }));
    expect(historicLessons(account.id)[0].actualOutcome).toBe("Short clips beat covers");
  });

  it("will not propose iteration without recorded analytics", () => {
    const campaign = createCampaign({ name: "No data" });
    expect(proposeIteration(campaign, []).available).toBe(false);
    expect(canApplyAiPlan("ADVISORY")).toBe(false);
    expect(canApplyAiPlan("ASSISTED")).toBe(true);
    expect(canAutoSchedule("AUTOPILOT")).toBe(true);
    expect(canAutoSchedule("ASSISTED")).toBe(false);
  });

  it("builds channel intelligence and coordination from recorded evidence", () => {
    const account = createAccount({ handle: "@djcoast", platform: "Instagram" });
    const campaign = createCampaign({ name: "Coord", accountIds: [account.id] });
    expect(analyzeAccountChannel(account).available).toBe(false);
    saveSnapshot({ campaignId: campaign.id, accountId: account.id, platform: "Instagram", source: "MANUAL", metrics: { saves: 40, views: 10 } });
    const channel = analyzeAccountChannel(account, { campaignId: campaign.id });
    expect(channel.available).toBe(true);
    expect(channel.strongestMetric.key).toBe("saves");
    const coordination = proposeCoordination(campaign, [account]);
    expect(coordination.available).toBe(true);
    expect(coordination.proposals[0].action).toBe("continue");
  });

  it("keeps missing snapshot metrics null instead of zero", () => {
    const snap = saveSnapshot({ source: "MANUAL", metrics: { views: 12, likes: null } });
    expect(snap.metrics.likes).toBeNull();
    expect(snap.metrics.comments).toBeUndefined();
  });
});

describe("backup safety", () => {
  it("never includes tokens in backups", () => {
    createAccount({ displayName: "Safe", handle: "@safe", accessToken: "should-not-persist" });
    const backup = exportBackup();
    expect(JSON.stringify(backup)).not.toContain("should-not-persist");
    expect(JSON.stringify(backup)).not.toContain("accessToken");
  });
});
