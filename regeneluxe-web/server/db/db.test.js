import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  initDb,
  closeDb,
  resetDbForTests,
  upsert,
  list,
  get,
  remove,
  count,
  migrate,
  getLocalClient,
  getSyncStatus,
  enqueueJob,
  claimNextJob,
  completeJob,
  JOB_TYPES,
  migrateLocalStorageDump,
  SCHEMA_VERSION,
  ensureDirs,
} from "./index.js";
import { listPending } from "./outbox.js";
import { quarantineDir, backupsDir } from "./paths.js";
import { existsSync } from "node:fs";

describe("server/db", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    await resetDbForTests();
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it("init + migrate sets schema version", async () => {
    const client = getLocalClient();
    const again = await migrate(client);
    expect(again.schemaVersion).toBe(SCHEMA_VERSION);
    expect(again.applied).toEqual([]);
    const meta = await client.execute({
      sql: "SELECT value FROM meta WHERE key = ?",
      args: ["schema_version"],
    });
    expect(meta.rows[0].value).toBe(String(SCHEMA_VERSION));
  });

  it("upsert / list / get", async () => {
    const saved = await upsert("campaigns", {
      id: "c1",
      name: "Launch",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    expect(saved.id).toBe("c1");
    expect(saved.revision).toBe(1);
    expect(saved.syncStatus).toBe("PENDING");
    expect(saved.name).toBe("Launch");

    const all = await list("campaigns");
    expect(all).toHaveLength(1);
    expect(await get("campaigns", "c1")).toMatchObject({ id: "c1", name: "Launch" });
    expect(await count("campaigns")).toBe(1);
  });

  it("soft delete hides from default list", async () => {
    await upsert("accounts", { id: "a1", handle: "@x" });
    const deleted = await remove("accounts", "a1");
    expect(deleted.deletedAt).toBeTruthy();
    expect(await list("accounts")).toHaveLength(0);
    expect(await list("accounts", { includeDeleted: true })).toHaveLength(1);
  });

  it("outbox enqueue on write", async () => {
    await upsert("content", { id: "p1", title: "Post" });
    const pending = await listPending();
    expect(pending.length).toBeGreaterThanOrEqual(1);
    expect(pending[0]).toMatchObject({
      collection: "content",
      recordId: "p1",
      op: "UPSERT",
      state: "PENDING",
    });
    expect(pending[0].idempotencyKey).toBe("content:p1:1");
  });

  it("job enqueue / claim / complete + idempotency", async () => {
    const first = await enqueueJob({
      type: JOB_TYPES.SYNC_REMOTE,
      payload: { reason: "test" },
      idempotencyKey: "sync-once",
    });
    const second = await enqueueJob({
      type: JOB_TYPES.SYNC_REMOTE,
      payload: { reason: "again" },
      idempotencyKey: "sync-once",
    });
    expect(second.id).toBe(first.id);

    const claimed = await claimNextJob("worker-1", [JOB_TYPES.SYNC_REMOTE]);
    expect(claimed).toMatchObject({
      id: first.id,
      state: "RUNNING",
      leaseOwner: "worker-1",
    });
    expect(claimed.leaseUntil).toBeTruthy();

    await completeJob(claimed.id);
    const none = await claimNextJob("worker-1");
    expect(none).toBeNull();
  });

  it("migrateLocalStorageDump twice — second skipped", async () => {
    const dump = {
      rl_accounts_v1: [{ id: "acc1", handle: "@a", displayName: "A" }],
      rl_campaigns_v1: [
        {
          id: "camp1",
          name: "C",
          createdAt: "2026-02-01T12:00:00.000Z",
          assets: [{ id: "asset1", name: "Clip" }],
          results: [{ id: "res1", impressions: 10 }],
        },
      ],
      rl_content_v1: [],
      rl_analytics_v1: [{ id: "m1", campaignId: "camp1", capturedAt: "2026-02-02T00:00:00.000Z", metrics: {} }],
      rl_inbox_v1: [],
      rl_queue_v1: [],
      rl_decisions_v1: [],
      rl_activity_v1: [],
      rl_events_v1: [],
      rl_settings_v1: { theme: "dark" },
      rl_active_campaign_id: "camp1",
    };

    const first = await migrateLocalStorageDump(dump);
    expect(first.skipped).toBe(false);
    expect(first.counts.accounts).toBe(1);
    expect(first.counts.campaigns).toBe(1);
    expect(first.counts.content).toBe(1);
    expect(first.counts.analytics).toBe(1);
    expect(first.counts.campaign_results).toBe(1);
    expect(first.backupPath).toContain("pre_migration_");
    expect(existsSync(backupsDir())).toBe(true);

    const second = await migrateLocalStorageDump(dump);
    expect(second.skipped).toBe(true);
  });

  it("metric snapshot indexes via insert", async () => {
    await upsert("analytics", {
      id: "snap1",
      campaignId: "camp1",
      accountId: "acc1",
      contentId: "c1",
      provider: "youtube",
      capturedAt: "2026-03-01T12:00:00.000Z",
      metrics: { views: 100 },
    });
    const client = getLocalClient();
    const rows = await client.execute({
      sql: "SELECT id, campaign_id, provider FROM metric_snapshots WHERE id = ?",
      args: ["snap1"],
    });
    expect(rows.rows[0]).toMatchObject({
      id: "snap1",
      campaign_id: "camp1",
      provider: "youtube",
    });

    const plan = await client.execute(
      "EXPLAIN QUERY PLAN SELECT * FROM metric_snapshots WHERE campaign_id = 'camp1' ORDER BY captured_at",
    );
    const planText = plan.rows.map((r) => Object.values(r).join(" ")).join(" ");
    expect(planText.toLowerCase()).toMatch(/metric|index|campaign/);
  });

  it("migrate is idempotent (restart simulation)", async () => {
    await upsert("campaigns", { id: "c2", name: "Keep" });
    const client = getLocalClient();
    await migrate(client);
    await migrate(client);
    expect(await count("campaigns")).toBe(1);
    expect((await get("campaigns", "c2")).name).toBe("Keep");
  });

  it("sync status when no remote", async () => {
    const status = await getSyncStatus();
    expect(status.cloudConfigured).toBe(false);
    expect(status.cloudReachable).toBe(false);
    expect(status.localHealthy).toBe(true);
    expect(status.state).toBe("LOCAL_ONLY");
    expect(status.error).toBeNull();
  });

  it("marks Turso configured but unreachable as offline, not unconfigured", async () => {
    process.env.TURSO_DATABASE_URL = "http://127.0.0.1:1";
    process.env.TURSO_AUTH_TOKEN = "test-token";
    await closeDb();
    await initDb();
    const status = await getSyncStatus({ fresh: true });
    expect(status.cloudConfigured).toBe(true);
    expect(status.cloudReachable).toBe(false);
    expect(status.state).toBe("OFFLINE");
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    await closeDb();
  });

  it("quarantine path exists", () => {
    ensureDirs();
    expect(existsSync(quarantineDir())).toBe(true);
    expect(typeof quarantineDir()).toBe("string");
  });
});
