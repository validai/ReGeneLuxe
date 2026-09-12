import { describe, expect, it } from "vitest";
import { createCampaign } from "./campaignRepository.js";
import { createAccount } from "./accountRepository.js";
import { saveContent, saveSnapshot } from "./collectionRepository.js";
import { emptyContentItem } from "./domain.js";
import {
  buildCampaignStateSnapshot,
  buildAttentionFeed,
  shouldRunCampaignBrain,
  nextBestAction,
  simpleContentLabel,
} from "./campaignMonitor.js";
import { listEvents, recordEvent } from "./events.js";
import { scheduleContent, markPublished } from "./publishing.js";

describe("campaignMonitor", () => {
  it("maps statuses to simple labels", () => {
    expect(simpleContentLabel("PLANNED")).toBe("Draft");
    expect(simpleContentLabel("SCHEDULED")).toBe("Scheduled");
  });

  it("builds a deterministic campaign snapshot", () => {
    const account = createAccount({ platform: "Instagram", handle: "@djcoast" });
    const campaign = createCampaign({
      name: "Teotihuacan",
      active: true,
      accountIds: [account.id],
      objective: "Grow awareness",
    });
    scheduleContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Reel one",
      accountIds: [account.id],
      status: "DRAFTING",
    }), new Date().toISOString());

    const snap = buildCampaignStateSnapshot(campaign);
    expect(snap.campaignId).toBe(campaign.id);
    expect(snap.active).toBe(true);
    expect(snap.content.scheduled).toBe(1);
    expect(snap.progressLabel).toBe("Running");
    expect(snap.summary).toContain("scheduled");
    expect(nextBestAction(snap)).toBeTruthy();
  });

  it("records events and drives attention", () => {
    const campaign = createCampaign({ name: "Notice me" });
    saveContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Needs eyes",
      status: "READY",
    }));
    const feed = buildAttentionFeed();
    expect(feed.some((item) => item.level === "ACTION")).toBe(true);
    expect(listEvents({ campaignId: campaign.id }).some((event) => event.type === "CAMPAIGN_CREATED")).toBe(true);
  });

  it("only suggests brain runs on meaningful change", () => {
    const campaign = createCampaign({ name: "Stable" });
    const first = buildCampaignStateSnapshot(campaign);
    expect(shouldRunCampaignBrain(first).run).toBe(false);

    const content = markPublished(emptyContentItem({
      campaignId: campaign.id,
      title: "Live",
      status: "SCHEDULED",
    }));
    expect(content.status).toBe("PUBLISHED");
    const second = buildCampaignStateSnapshot(campaign);
    expect(shouldRunCampaignBrain(second, first).run).toBe(true);
  });

  it("stores analytics refresh events", () => {
    const campaign = createCampaign({ name: "Metrics" });
    saveSnapshot({ campaignId: campaign.id, metrics: { saves: 12 }, source: "MANUAL" });
    expect(listEvents({ type: "ANALYTICS_REFRESHED" }).length).toBeGreaterThan(0);
    recordEvent("USER_OVERRIDE", { campaignId: campaign.id, message: "Paused iteration" });
    expect(listEvents({ campaignId: campaign.id }).some((event) => event.type === "USER_OVERRIDE")).toBe(true);
  });
});
