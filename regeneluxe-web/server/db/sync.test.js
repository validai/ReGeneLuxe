import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.RL_DB_MODE = "memory";
process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-sync-")), "secrets.json");

const {
  initDb,
  resetDbForTests,
  upsert,
  get,
  list,
  COLLECTIONS,
  pushOutboxToRemote,
  pullRemoteToLocal,
  getSyncStatus,
} = await import("./index.js");
const { OUTBOX_STATES } = await import("./outbox.js");

describe("sqlite primary + sync policies", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
  });

  it("upsert enqueues pending outbox for mutable records", async () => {
    const saved = await upsert(COLLECTIONS.campaigns, {
      id: "camp_1",
      name: "DJ Coast Launch",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(saved.revision).toBe(1);
    expect(saved.syncStatus).toBe("PENDING");
    const status = await getSyncStatus();
    expect(status.pendingOutbox).toBeGreaterThanOrEqual(1);
  });

  it("skipOutbox pull path marks SYNCED without growing outbox", async () => {
    await upsert(COLLECTIONS.analytics, {
      id: "snap_1",
      source: "PROVIDER",
      metrics: { views: 10 },
    }, null, { skipOutbox: true, forceRevision: 3 });
    const row = await get(COLLECTIONS.analytics, "snap_1");
    expect(row.syncStatus).toBe("SYNCED");
    expect(row.revision).toBe(3);
    const status = await getSyncStatus();
    expect(status.pendingOutbox).toBe(0);
  });

  it("append-only analytics keeps historical rows by id", async () => {
    await upsert(COLLECTIONS.analytics, { id: "a1", metrics: { views: 1 }, source: "MANUAL" });
    await upsert(COLLECTIONS.analytics, { id: "a2", metrics: { views: 2 }, source: "MANUAL" });
    const rows = await list(COLLECTIONS.analytics);
    expect(rows.map((r) => r.id).sort()).toEqual(["a1", "a2"]);
  });

  it("push without remote is a safe no-op", async () => {
    await upsert(COLLECTIONS.accounts, { id: "acc_1", platform: "YouTube", displayName: "DJ Coast" });
    const result = await pushOutboxToRemote();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_remote");
  });

  it("pull without remote is a safe no-op", async () => {
    const result = await pullRemoteToLocal();
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("no_remote");
  });

  it("mutable revision increments on each upsert", async () => {
    await upsert(COLLECTIONS.content, { id: "c1", title: "Teaser", status: "DRAFTING" });
    const second = await upsert(COLLECTIONS.content, { id: "c1", title: "Teaser v2", status: "READY" });
    expect(second.revision).toBe(2);
    expect(second.title).toBe("Teaser v2");
  });
});

describe("operational store hydrate", () => {
  it("hydrates campaigns and meta from snapshot", async () => {
    const {
      hydrateFromSnapshot,
      listCollection,
      getMetaValue,
      setOperationalPrimary,
      isOperationalPrimary,
      resetOperationalStore,
    } = await import("../../src/data/operationalStore.js");

    resetOperationalStore();
    hydrateFromSnapshot({
      campaigns: [{ id: "camp_x", name: "Teotihuacan" }],
      accounts: [{ id: "acc_x", platform: "YouTube" }],
      content: [],
      settings: { id: "app", theme: "dark" },
      activeCampaignId: "camp_x",
    });
    setOperationalPrimary(true);
    expect(isOperationalPrimary()).toBe(true);
    expect(listCollection("campaigns")[0].name).toBe("Teotihuacan");
    expect(getMetaValue("active_campaign_id")).toBe("camp_x");
    resetOperationalStore();
  });
});

void OUTBOX_STATES;
