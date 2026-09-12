import { describe, expect, it } from "vitest";
import { exportBackup, importBackup, validateBackup } from "./backupService.js";
import { createCampaign, listCampaigns } from "./campaignRepository.js";
import { createAccount, listAccounts } from "./accountRepository.js";
import { SCHEMA_VERSION } from "./models.js";

describe("backupService", () => {
  it("rejects invalid import without replacing data", () => {
    createCampaign({ name: "Keep me" });
    const before = listCampaigns().length;

    expect(validateBackup("nope").ok).toBe(false);
    expect(validateBackup({ campaigns: "bad" }).ok).toBe(false);
    expect(importBackup({ campaigns: "bad" }).ok).toBe(false);
    expect(listCampaigns()).toHaveLength(before);
  });

  it("exports restorable data and import replaces after validation", () => {
    const account = createAccount({ displayName: "A", handle: "@a", platform: "YouTube" });
    createCampaign({ name: "Backup campaign", accountIds: [account.id] });

    const backup = exportBackup();
    expect(backup.app).toBe("ReGeneLuxe");
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect(backup.campaigns).toHaveLength(1);
    expect(backup.accounts).toHaveLength(1);
    expect(validateBackup(backup).ok).toBe(true);

    const result = importBackup({
      app: "ReGeneLuxe",
      kind: "local-backup",
      campaigns: [{ id: "imp_1", name: "Imported" }],
      accounts: [{ id: "acc_imp", displayName: "Imported acc", handle: "@imp", platform: "TikTok" }],
      settings: {},
    });

    expect(result.ok).toBe(true);
    expect(listCampaigns().map((c) => c.name)).toContain("Imported");
    expect(listAccounts().map((a) => a.handle)).toContain("@imp");
  });

  it("imports a legacy schema backup and migrates status", () => {
    const result = importBackup({
      app: "ReGeneLuxe",
      kind: "local-backup",
      schemaVersion: 1,
      campaigns: [
        {
          id: "old_cmp",
          name: "Old draft",
          status: "DRAFT",
          stage: "ASSET_PLANNING",
          onboarding: { objective: "Streams", offer: "Single" },
        },
        {
          id: "old_done",
          name: "Old archive",
          status: "ARCHIVED",
          stage: "COMPLETE",
        },
      ],
      accounts: [{ id: "old_acc", displayName: "Legacy acc", handle: "@old", platform: "Instagram", status: "inactive" }],
    });

    expect(result.ok).toBe(true);
    const campaigns = listCampaigns();
    const draft = campaigns.find((item) => item.id === "old_cmp");
    const archived = campaigns.find((item) => item.id === "old_done");
    expect(draft.active).toBe(true);
    expect(draft.currentSection).toBe("CONTENT");
    expect(draft.intake.objective).toBe("Streams");
    expect(archived.active).toBe(false);
    expect(listAccounts()[0].active).toBe(false);
  });

  it("imports a new-schema backup without losing structured intake", () => {
    const result = importBackup({
      app: "ReGeneLuxe",
      kind: "local-backup",
      schemaVersion: 3,
      campaigns: [{
        id: "new_cmp",
        name: "Structured import",
        active: false,
        currentSection: "BLUEPRINT",
        intake: {
          goals: ["awareness", "other"],
          goalsOther: "Press",
          promoted: { primary: "album", title: "Imported album" },
        },
      }],
      accounts: [{ id: "new_acc", displayName: "Now", handle: "@now", platform: "TikTok", active: true }],
    });

    expect(result.ok).toBe(true);
    const campaign = listCampaigns().find((item) => item.id === "new_cmp");
    expect(campaign.active).toBe(false);
    expect(campaign.currentSection).toBe("STRATEGY");
    expect(campaign.intake.goals).toEqual(["awareness", "other"]);
    expect(campaign.intake.goalsOther).toBe("Press");
    expect(campaign.intake.promoted.title).toBe("Imported album");
    expect(listAccounts()[0].active).toBe(true);
  });
});
