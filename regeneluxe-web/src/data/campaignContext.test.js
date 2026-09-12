import { describe, expect, it } from "vitest";
import { emptyCampaign, emptyAccount } from "./models.js";
import {
  buildCampaignContext,
  campaignCompleteness,
  diagnoseCampaignContext,
  deriveBlueprintFromIntake,
  hasCampaignGoal,
  hasAudienceDefinition,
  hasTargetAccount,
  hasContentDefinition,
  hasSuccessSignal,
  hasEnoughContextForBlueprint,
  hasEnoughContextForFutureAgent,
} from "./campaignContext.js";

function definedCampaign(accountId = "acc_1") {
  return emptyCampaign({
    id: "cmp_ctx",
    name: "Teotihuacan Album Launch",
    active: true,
    currentSection: "OVERVIEW",
    accountIds: [accountId],
    intake: {
      goals: ["release_promotion", "music_streams", "audience_growth"],
      promoted: { primary: "album", title: "Teotihuacan", description: "Album launch" },
      audience: {
        relationships: ["new_audience"],
        ageRanges: ["18_24", "25_34"],
        geography: ["united_states"],
        interests: ["hip_hop", "independent_music"],
      },
      accountIds: [accountId],
      contentFormats: ["reel", "short", "visualizer"],
      creative: { tone: ["cinematic", "dark"], visual: ["polished"] },
      messaging: { cta: "stream_release", themes: ["new_release"], keyMessage: "Listen now" },
      strategy: ["release_day_push", "short_form_heavy"],
      availableAssets: ["artwork", "short_clips"],
      constraints: ["limited_budget"],
      success: { primary: "saves", secondary: ["streams"] },
      testing: { hypotheses: ["creative"], hypothesisText: "Performance clips beat visualizers." },
    },
  });
}

describe("campaign context contract", () => {
  it("builds one normalized object with account context", () => {
    const account = emptyAccount({
      id: "acc_1",
      platform: "Instagram",
      handle: "@djcoast",
      displayName: "DJ Coast",
      role: "primary",
      platformStrengths: "Reels",
    });
    const context = buildCampaignContext(definedCampaign(), [account]);
    expect(context.campaignId).toBe("cmp_ctx");
    expect(context.active).toBe(true);
    expect(context.purposeValues).toContain("release_promotion");
    expect(context.purpose).toContain("Release promotion");
    expect(context.promotedContent.title).toBe("Teotihuacan");
    expect(context.accounts[0].handle).toBe("@djcoast");
    expect(context.accounts[0].platformStrengths).toBe("Reels");
    expect(context.diagnostics.ready).toBe(true);
    expect(context.currentArea).toBe("Overview");
  });

  it("marks deleted account references as missing", () => {
    const context = buildCampaignContext(definedCampaign("gone"), []);
    expect(context.accounts[0]).toEqual({ id: "gone", missing: true });
    expect(context.diagnostics.hasEnoughContextForFutureAgent).toBe(false);
  });

  it("reports readiness diagnostics without blocking", () => {
    const empty = emptyCampaign({ name: "Blank" });
    const diagnosis = diagnoseCampaignContext(empty, []);
    expect(diagnosis.ready).toBe(false);
    expect(diagnosis.missing).toEqual(expect.arrayContaining([
      "campaign_goal",
      "content_definition",
      "audience_definition",
      "target_account",
      "success_signal",
    ]));
    expect(hasCampaignGoal(empty.intake)).toBe(false);
    expect(hasAudienceDefinition(empty.intake)).toBe(false);
    expect(hasTargetAccount(empty, empty.intake)).toBe(false);
    expect(hasContentDefinition(empty.intake)).toBe(false);
    expect(hasSuccessSignal(empty.intake)).toBe(false);
    expect(hasEnoughContextForFutureAgent(empty, [])).toBe(false);
  });

  it("calculates completeness from the six core categories", () => {
    expect(campaignCompleteness(emptyCampaign()).percent).toBe(0);
    expect(campaignCompleteness(definedCampaign()).percent).toBe(100);
  });

  it("maps structured intake into blueprint copy", () => {
    const account = emptyAccount({ id: "acc_1", platform: "Instagram", handle: "@djcoast" });
    const derived = deriveBlueprintFromIntake(definedCampaign(), [account]);
    expect(derived.objective).toContain("Release promotion");
    expect(derived.audience).toContain("New audience");
    expect(derived.channelStrategy).toContain("@djcoast");
    expect(derived.contentFormats).toContain("Reel");
    expect(derived.successCriteria).toContain("Saves");
    expect(hasEnoughContextForBlueprint(definedCampaign(), [account])).toBe(true);
  });
});
