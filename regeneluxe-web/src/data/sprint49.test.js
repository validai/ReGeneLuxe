import { describe, expect, it } from "vitest";
import { compareCampaignSnapshots, classifyMetricMove, shouldIgnoreAsNoise } from "./changeDetector.js";
import {
  buildCampaignStateSnapshot,
  observeCampaign,
  shouldRunCampaignBrain,
} from "./campaignMonitor.js";
import { createCampaign } from "./campaignRepository.js";
import { createAccount } from "./accountRepository.js";
import { saveSnapshot } from "./collectionRepository.js";
import { emptyContentItem } from "./domain.js";
import { markPublished, scheduleContent } from "./publishing.js";
import {
  recordDecisionJournal,
  respondToDecision,
  evaluateDecisionOutcome,
  shouldSuppressRecommendation,
} from "./decisionJournal.js";
import { validateBrainOutput } from "./ai/validator.js";
import { applyBrainOutput, buildBrainInput } from "./ai/campaignBrain.js";
import { buildCampaignStrategySummary } from "./campaignSummary.js";
import { buildAccountBaseline, compareAgainstBaseline } from "./performanceCompare.js";

describe("change detector", () => {
  it("ignores timestamp-only noise and detects publications", () => {
    const base = {
      campaignId: "c1",
      active: true,
      objective: "Grow",
      content: { ideas: 0, drafts: 1, ready: 0, scheduled: 1, published: 0, failed: 0 },
      publishing: { overdue: 0, failed: 0, gaps: false },
      accounts: { unhealthy: 0 },
      analytics: { snapshotCount: 1, primaryMetrics: [{ key: "saves", value: 10 }] },
      experiments: { completed: 0 },
      approvals: { waiting: 0 },
    };
    const same = { ...base, observedAt: "later" };
    expect(shouldIgnoreAsNoise(base, same)).toBe(true);

    const published = {
      ...base,
      content: { ...base.content, published: 1, scheduled: 0 },
      analytics: { snapshotCount: 2, primaryMetrics: [{ key: "saves", value: 20 }] },
    };
    const diff = compareCampaignSnapshots(base, published);
    expect(diff.meaningful).toBe(true);
    expect(diff.changes.some((item) => item.type === "CONTENT_PUBLISHED")).toBe(true);
  });

  it("classifies metric movement without claiming statistical significance", () => {
    expect(classifyMetricMove(10, 11)).toBe("NORMAL");
    expect(classifyMetricMove(10, 15)).toBe("MEANINGFUL_UP");
    expect(classifyMetricMove(10, 5)).toBe("MEANINGFUL_DOWN");
  });
});

describe("campaign monitor observe loop", () => {
  it("detects content gaps and publication changes", () => {
    const account = createAccount({ platform: "Instagram", handle: "@coast" });
    const campaign = createCampaign({ name: "Teotihuacan", accountIds: [account.id], active: true });
    const first = observeCampaign(campaign);
    expect(first.snapshot.publishing.gaps).toBe(true);

    scheduleContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Clip",
      accountIds: [account.id],
    }), new Date().toISOString());

    const second = observeCampaign(campaign);
    expect(second.meaningful).toBe(true);
    expect(second.snapshot.content.scheduled).toBeGreaterThan(0);
  });

  it("does not request brain on unchanged state", () => {
    const campaign = createCampaign({ name: "Stable" });
    const first = buildCampaignStateSnapshot(campaign);
    expect(shouldRunCampaignBrain(first).run).toBe(false);
    expect(shouldRunCampaignBrain(first, first).run).toBe(false);
  });
});

describe("decision journal + brain contracts", () => {
  it("validates brain output and refuses malformed mutation", () => {
    expect(validateBrainOutput(null).ok).toBe(false);
    expect(validateBrainOutput({ campaignSummary: "ok" }).ok).toBe(false);
    const good = validateBrainOutput({
      campaignSummary: "Running normally",
      nextBestAction: "Approve reel",
      findings: ["Instagram leading"],
      evidenceRefs: ["snap:1"],
    });
    expect(good.ok).toBe(true);

    const campaign = createCampaign({ name: "Safe" });
    const refused = applyBrainOutput(campaign, { hello: true });
    expect(refused.ok).toBe(false);
  });

  it("records, suppresses duplicates, remembers rejection, and evaluates outcomes", () => {
    const campaign = createCampaign({ name: "Learn" });
    const decision = recordDecisionJournal({
      campaignId: campaign.id,
      decision: "Post more Reels",
      expectedOutcome: "Higher saves",
      evidence: "Reels outperformed static posts",
    });
    expect(shouldSuppressRecommendation("Post more Reels", { campaignId: campaign.id })).toBe(true);

    respondToDecision(decision.id, "reject", "Not now");
    expect(shouldSuppressRecommendation("Post more Reels", { campaignId: campaign.id })).toBe(true);
    expect(shouldSuppressRecommendation("Post more Reels", { campaignId: campaign.id, newEvidence: true })).toBe(false);

    const scored = evaluateDecisionOutcome(decision.id, {
      actualOutcome: "Saves +26%",
      metricDelta: 26,
      enoughEvidence: true,
    });
    expect(scored.outcomeLabel).toBe("POSITIVE");
  });

  it("builds brain input without secrets", () => {
    const account = createAccount({
      platform: "YouTube",
      handle: "Coast",
      accessToken: "secret-token",
    });
    const campaign = createCampaign({ name: "Input", accountIds: [account.id] });
    const input = buildBrainInput(campaign, [account]);
    expect(JSON.stringify(input)).not.toMatch(/secret-token/);
    expect(input.strategy).toBeTruthy();
    expect(input.snapshot.campaignId).toBe(campaign.id);
  });
});

describe("strategy compression + baselines", () => {
  it("compresses intake into operator summary", () => {
    const campaign = createCampaign({
      name: "Album",
      objective: "Streams",
      intake: {
        goals: ["reach"],
        promoted: { title: "Teotihuacan" },
        success: { primary: "streams" },
      },
    });
    const summary = buildCampaignStrategySummary(campaign, []);
    expect(summary.lines.length).toBeGreaterThan(0);
    expect(summary.text).toMatch(/GOAL|PROMOTING|SUCCESS/i);
  });

  it("only builds baselines with enough data", () => {
    expect(buildAccountBaseline([]).available).toBe(false);
    const snaps = [
      { metrics: { saves: 10 } },
      { metrics: { saves: 12 } },
      { metrics: { saves: 14 } },
    ];
    const baseline = buildAccountBaseline(snaps);
    expect(baseline.available).toBe(true);
    const compared = compareAgainstBaseline({ saves: 20 }, baseline);
    expect(compared.available).toBe(true);
    expect(compared.comparisons[0].classification).toMatch(/MEANINGFUL_UP|OUTLIER/);
  });
});

describe("north-star local scenario", () => {
  it("create → schedule → analytics → observe → next action → decision learning", () => {
    const ig = createAccount({ platform: "Instagram", handle: "@djcoast" });
    const yt = createAccount({ platform: "YouTube", handle: "Coast Entertainment" });
    const campaign = createCampaign({
      name: "TEOTIHUACAN ALBUM LAUNCH",
      active: true,
      accountIds: [ig.id, yt.id],
      objective: "Album discovery",
      intake: {
        goals: ["reach"],
        promoted: { title: "Teotihuacan" },
        success: { primary: "streams" },
        testing: { hypotheses: ["performance_vs_visualizer"] },
      },
    });

    const content = scheduleContent(emptyContentItem({
      campaignId: campaign.id,
      title: "Performance clip",
      format: "Reel",
      accountIds: [ig.id],
      provenance: "USER",
    }), new Date(Date.now() + 86400000).toISOString());

    expect(content.status).toBe("SCHEDULED");

    markPublished(content);
    saveSnapshot({
      campaignId: campaign.id,
      accountId: ig.id,
      platform: "Instagram",
      contentId: content.id,
      source: "MANUAL",
      metrics: { saves: 41, reach: 1200 },
    });
    saveSnapshot({
      campaignId: campaign.id,
      accountId: yt.id,
      platform: "YouTube",
      source: "MANUAL",
      metrics: { views: 200 },
    });
    saveSnapshot({
      campaignId: campaign.id,
      accountId: ig.id,
      platform: "Instagram",
      source: "MANUAL",
      metrics: { saves: 50 },
    });

    const observation = observeCampaign(campaign, {});
    expect(observation.meaningful || observation.shouldRunBrain).toBe(true);

    const applied = applyBrainOutput(campaign, {
      campaignSummary: "Instagram is currently strongest for this campaign.",
      importantChanges: observation.changes.map((item) => item.message),
      findings: ["Instagram saves lead YouTube for this window"],
      nextBestAction: "Reuse the winning Reel format on Instagram",
      recommendations: ["Reuse the winning Reel format on Instagram"],
      contentChanges: [],
      schedulingChanges: [],
      experimentActions: [],
      approvalRequests: [],
      warnings: [],
      confidence: 0.7,
      evidenceRefs: ["analytics:manual"],
    });
    expect(applied.ok).toBe(true);
    expect(applied.decision?.decision).toMatch(/Reel/i);

    respondToDecision(applied.decision.id, "accept");
    const learned = evaluateDecisionOutcome(applied.decision.id, {
      actualOutcome: "Saves +23%",
      metricDelta: 23,
      enoughEvidence: true,
    });
    expect(learned.outcomeLabel).toBe("POSITIVE");
  });
});
