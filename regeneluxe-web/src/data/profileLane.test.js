import { describe, expect, it } from "vitest";
import { filterByActiveProfile, stampProfile, setActiveProfileId, getActiveProfileId } from "./profileScope.js";
import { createCampaign, listCampaigns } from "./campaignRepository.js";
import { createAccount, listAccounts } from "./accountRepository.js";
import { sanitizeAiContext } from "./ai/validator.js";
import { exportBackup } from "./backupService.js";
import { publicOperator, isFixtureRecord } from "./profileModels.js";
import { stripSecretFields } from "./secretFields.js";

describe("profile repository scoping", () => {
  it("does not filter when no active profile is selected", () => {
    createCampaign({ name: "Open" });
    expect(listCampaigns()).toHaveLength(1);
  });

  it("filters campaigns and accounts by activeProfileId", () => {
    const a = createCampaign({ name: "A", managedProfileId: "prf_a" });
    createCampaign({ name: "B", managedProfileId: "prf_b" });
    createAccount({ handle: "@a", managedProfileId: "prf_a" });
    createAccount({ handle: "@b", managedProfileId: "prf_b" });
    setActiveProfileId("prf_a");
    expect(getActiveProfileId()).toBe("prf_a");
    expect(listCampaigns().map((row) => row.id)).toEqual([a.id]);
    expect(listAccounts().map((row) => row.handle)).toEqual(["@a"]);
    expect(listCampaigns({ scoped: false })).toHaveLength(2);
  });

  it("stamps new records with the active profile", () => {
    setActiveProfileId("prf_live");
    const campaign = createCampaign({ name: "Stamped" });
    expect(campaign.managedProfileId).toBe("prf_live");
    expect(stampProfile({ name: "x" }).managedProfileId).toBe("prf_live");
  });

  it("supports future multi-profile ownership in the same helper", () => {
    const records = [
      { id: "1", managedProfileId: "p1" },
      { id: "2", managedProfileId: "p2" },
    ];
    expect(filterByActiveProfile(records, { profileId: "p2" }).map((row) => row.id)).toEqual(["2"]);
    expect(filterByActiveProfile(records, { scoped: false })).toHaveLength(2);
  });
});

describe("secret exclusion", () => {
  it("strips tokens, client secrets, and googleSub from Campaign Brain context", () => {
    const clean = sanitizeAiContext({
      name: "DJ Coast",
      googleSub: "sub",
      apiKey: "sk-live",
      nested: { accessToken: "tok", refreshToken: "ref", client_secret: "cs" },
    });
    expect(clean.name).toBe("DJ Coast");
    expect(clean.googleSub).toBeUndefined();
    expect(clean.apiKey).toBeUndefined();
    expect(clean.nested.accessToken).toBeUndefined();
    expect(clean.nested.refreshToken).toBeUndefined();
    expect(clean.nested.client_secret).toBeUndefined();
  });

  it("strips secrets from backup export payloads", () => {
    const backup = exportBackup();
    const serialized = JSON.stringify(backup);
    expect(serialized).not.toMatch(/accessToken/);
    expect(serialized).not.toMatch(/AUTH_SECRET/);
    expect(serialized).not.toMatch(/TURSO_AUTH_TOKEN/);
    expect(serialized).not.toMatch(/AUTH_GOOGLE_SECRET/);
  });

  it("omits googleSub from public operator rows", () => {
    expect(publicOperator({ id: "1", googleSub: "x", email: "a@b.c" }).googleSub).toBeUndefined();
  });

  it("stripSecretFields removes OAuth material", () => {
    const clean = stripSecretFields({
      id: "1",
      refresh_token: "r",
      AUTH_GOOGLE_SECRET: "s",
      TURSO_AUTH_TOKEN: "t",
    });
    expect(clean.refresh_token).toBeUndefined();
    expect(clean.AUTH_GOOGLE_SECRET).toBeUndefined();
    expect(clean.TURSO_AUTH_TOKEN).toBeUndefined();
    expect(clean.id).toBe("1");
  });
});

describe("fixture detection", () => {
  it("does not treat ordinary operator records as fixtures", () => {
    expect(isFixtureRecord({ id: "camp_real", name: "Live" })).toBe(false);
    expect(isFixtureRecord({ id: "test_1" })).toBe(true);
    expect(isFixtureRecord({ id: "x", provenance: "TEST" })).toBe(true);
  });
});
