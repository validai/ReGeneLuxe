import { describe, expect, it } from "vitest";
import {
  createCampaign,
  updateCampaign,
  listCampaigns,
  getCampaign,
  setCampaignActive,
} from "./campaignRepository.js";
import { createAccount, deleteAccount, listAccounts, resolveAccount, updateAccount } from "./accountRepository.js";
import { STORAGE_KEYS, writeJson } from "./storage.js";

describe("campaign and account repositories", () => {
  it("creates and persists a campaign as active", () => {
    const campaign = createCampaign({ name: "Test run" });
    expect(getCampaign(campaign.id).name).toBe("Test run");
    expect(getCampaign(campaign.id).active).toBe(true);
    expect(getCampaign(campaign.id).currentSection).toBe("OVERVIEW");
    expect(listCampaigns()).toHaveLength(1);
  });

  it("edits intake and toggles active/inactive", () => {
    const campaign = createCampaign({ name: "Edit me" });
    updateCampaign(campaign.id, { name: "Edited", intake: { goals: ["reach"], objective: "Reach" } });
    expect(getCampaign(campaign.id).name).toBe("Edited");
    expect(getCampaign(campaign.id).intake.goals).toEqual(["reach"]);
    expect(getCampaign(campaign.id).intake.objective).toBe("Reach");
    setCampaignActive(campaign.id, false);
    expect(getCampaign(campaign.id).active).toBe(false);
    setCampaignActive(campaign.id, true);
    expect(getCampaign(campaign.id).active).toBe(true);
  });

  it("persists structured intake including Other text", () => {
    const campaign = createCampaign({ name: "Structured" });
    updateCampaign(campaign.id, {
      intake: {
        goals: ["release_promotion", "other"],
        goalsOther: "Playlist pitching",
        promoted: { primary: "album", title: "Teotihuacan" },
        audience: { relationships: ["new_audience"], ageRanges: ["18_24"] },
        contentFormats: ["reel", "other"],
        contentFormatsOther: "Live clip",
      },
      accountIds: [],
    });
    const saved = getCampaign(campaign.id);
    expect(saved.intake.goals).toEqual(["release_promotion", "other"]);
    expect(saved.intake.goalsOther).toBe("Playlist pitching");
    expect(saved.intake.promoted.title).toBe("Teotihuacan");
    expect(saved.intake.contentFormatsOther).toBe("Live clip");
  });

  it("creates and persists an account with active boolean", () => {
    const account = createAccount({
      platform: "Instagram",
      displayName: "Studio",
      handle: "@studio",
      profileUrl: "https://instagram.com/studio",
    });
    expect(listAccounts()[0].id).toBe(account.id);
    expect(listAccounts()[0].connectionMethod).toBe("MANUAL");
    expect(listAccounts()[0].active).toBe(true);
    updateAccount(account.id, { active: false, role: "primary" });
    expect(listAccounts()[0].active).toBe(false);
    expect(listAccounts()[0].role).toBe("primary");
  });

  it("associates accounts to campaigns by id", () => {
    const account = createAccount({ displayName: "Main", handle: "@main" });
    const campaign = createCampaign({ name: "Linked", accountIds: [account.id] });
    expect(getCampaign(campaign.id).accountIds).toContain(account.id);
  });

  it("saves intake, blueprint, assets, results, and iteration", () => {
    const campaign = createCampaign({ name: "Loop" });
    updateCampaign(campaign.id, {
      intake: { objective: "Test a hook", offer: "Single", goals: ["creative_testing"] },
      blueprint: { objective: "Test a hook", coreMessage: "Listen now" },
      assets: [{ id: "ast_1", name: "Teaser", accountId: "", status: "IDEA" }],
      results: [{ id: "res_1", assetId: "ast_1", metrics: { views: "1200" } }],
      iteration: { whatWorked: "First 3 seconds" },
    });
    const saved = getCampaign(campaign.id);
    expect(saved.intake.objective).toBe("Test a hook");
    expect(saved.blueprint.coreMessage).toBe("Listen now");
    expect(saved.assets[0].name).toBe("Teaser");
    expect(saved.results[0].metrics.views).toBe("1200");
    expect(saved.iteration.whatWorked).toBe("First 3 seconds");
  });

  it("does not crash when an associated account is deleted", () => {
    const account = createAccount({ displayName: "Gone", handle: "@gone" });
    const campaign = createCampaign({ name: "Orphan", accountIds: [account.id] });
    deleteAccount(account.id);
    expect(resolveAccount(account.id)).toBeNull();
    expect(getCampaign(campaign.id).accountIds).toContain(account.id);
  });

  it("migrates existing rl_campaigns_v1 records on list", () => {
    writeJson(STORAGE_KEYS.campaigns, [
      {
        id: "legacy_1",
        name: "Legacy",
        status: "DRAFT",
        stage: "INTAKE",
        createdAt: "2026-02-01T00:00:00.000Z",
        tierId: "regular",
        onboarding: { objective: "Leads", offer: "Session" },
      },
    ]);
    writeJson(STORAGE_KEYS.schemaVersion, 1);
    const [migrated] = listCampaigns();
    expect(migrated.id).toBe("legacy_1");
    expect(migrated.active).toBe(true);
    expect(migrated.currentSection).toBe("STRATEGY");
    expect(migrated.status).toBeUndefined();
    expect(migrated.intake.objective).toBe("Leads");
    expect(migrated.tierId).toBeUndefined();
    const again = listCampaigns();
    expect(again[0].updatedAt).toBe(migrated.updatedAt);
  });

  it("migrates legacy inactive accounts on list", () => {
    writeJson(STORAGE_KEYS.accounts, [
      { id: "acc_old", displayName: "Quiet", handle: "@quiet", status: "inactive", platform: "YouTube" },
    ]);
    expect(listAccounts()[0].active).toBe(false);
  });
});
