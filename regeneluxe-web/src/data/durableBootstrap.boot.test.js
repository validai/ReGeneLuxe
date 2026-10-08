import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listCollection, resetOperationalStore } from "./operationalStore.js";
import {
  bootstrapDurableStore,
  fetchDbHealth,
  reconcileCloud,
  refreshOperationalSnapshot,
  resetDurableHealthForTests,
} from "./durableBootstrap.js";

function jsonResponse(body, ok = true) {
  return { ok, json: async () => body };
}

function healthy(sync = {}) {
  return {
    ok: true,
    local: { healthy: true },
    sync: {
      cloudConfigured: true,
      cloudReachable: true,
      state: "SYNCED",
      pendingOutbox: 0,
      localHealthy: true,
      ...sync,
    },
  };
}

function installFetch(handlers) {
  const counts = { health: 0, migrate: 0, snapshot: 0, syncPost: 0, syncGet: 0 };
  vi.stubGlobal("fetch", vi.fn(async (url, init) => {
    const target = String(url);
    const method = String(init?.method || "GET").toUpperCase();
    if (target.includes("/api/db/health")) {
      counts.health += 1;
      return handlers.health(counts);
    }
    if (target.includes("/api/migrate/local-storage")) {
      counts.migrate += 1;
      return handlers.migrate(counts);
    }
    if (target.includes("/api/data/snapshot")) {
      counts.snapshot += 1;
      return handlers.snapshot(counts);
    }
    if (target.includes("/api/sync")) {
      if (method === "GET") {
        counts.syncGet += 1;
        return handlers.syncGet?.(counts);
      }
      counts.syncPost += 1;
      return handlers.syncPost(counts);
    }
    throw new Error(`unexpected ${method} ${target}`);
  }));
  return counts;
}

async function settle() {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

describe("application bootstrap", () => {
  beforeEach(() => {
    resetDurableHealthForTests();
    resetOperationalStore();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetDurableHealthForTests();
    resetOperationalStore();
  });

  it("runs one migration, one health read, one reconcile, and two snapshots for a cold boot", async () => {
    const counts = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ ok: true, skipped: true }),
      snapshot: async () => jsonResponse({ data: { campaigns: [{ id: "camp_boot", name: "Boot" }] } }),
      syncPost: async () => jsonResponse({
        ok: true,
        status: healthy().sync,
      }),
    });

    const first = bootstrapDurableStore();
    const second = bootstrapDurableStore();
    const third = bootstrapDurableStore();
    const [a, b, c] = await Promise.all([first, second, third]);
    await a.reconcile;
    await settle();

    expect(b).toBe(a);
    expect(c).toBe(a);
    expect(counts).toEqual({ health: 1, migrate: 1, snapshot: 2, syncPost: 1, syncGet: 0 });
    expect(listCollection("campaigns").map((row) => row.name)).toEqual(["Boot"]);
  });

  it("shares one health request across consumers and allows a later refresh", async () => {
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const counts = installFetch({
      health: async () => {
        if (counts.health === 1) await gate;
        return jsonResponse(healthy({ state: counts.health === 1 ? "PENDING" : "SYNCED" }));
      },
      migrate: async () => jsonResponse({ ok: true }),
      snapshot: async () => jsonResponse({ data: { campaigns: [] } }),
      syncPost: async () => jsonResponse({ ok: true, status: healthy().sync }),
    });

    const first = fetchDbHealth();
    const second = fetchDbHealth();
    expect(counts.health).toBe(1);
    release();
    const [left, right] = await Promise.all([first, second]);
    expect(left.sync.state).toBe("PENDING");
    expect(right.sync.state).toBe("PENDING");

    const third = await fetchDbHealth();
    expect(counts.health).toBe(2);
    expect(third.sync.state).toBe("SYNCED");
  });

  it("does not repeat boot on a later call, and a settings health read does not reconcile", async () => {
    const counts = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ ok: true, skipped: true }),
      snapshot: async () => jsonResponse({ data: { campaigns: [] } }),
      syncPost: async () => jsonResponse({ ok: true, status: healthy().sync }),
    });

    const boot = await bootstrapDurableStore();
    await boot.reconcile;
    const afterBoot = { ...counts };

    const again = await bootstrapDurableStore();
    expect(again.already).toBe(true);
    expect(counts).toEqual(afterBoot);

    await fetchDbHealth();
    expect(counts.health).toBe(afterBoot.health + 1);
    expect(counts.migrate).toBe(1);
    expect(counts.snapshot).toBe(2);
    expect(counts.syncPost).toBe(1);
    expect(counts.syncGet).toBe(0);
  });

  it("runs a later Sync now again and coalesces a duplicate click", async () => {
    let release;
    const counts = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ ok: true }),
      snapshot: async () => jsonResponse({ data: { campaigns: [] } }),
      syncPost: async () => {
        if (counts.syncPost === 2) {
          await new Promise((resolve) => {
            release = resolve;
          });
        }
        return jsonResponse({ ok: true, status: healthy().sync });
      },
    });

    const boot = await bootstrapDurableStore();
    await boot.reconcile;
    expect(counts.syncPost).toBe(1);

    const firstClick = reconcileCloud({ pull: true, push: true });
    const secondClick = reconcileCloud({ pull: true, push: true });
    expect(counts.syncPost).toBe(2);
    release();
    await Promise.all([firstClick, secondClick]);

    await reconcileCloud({ pull: true, push: true });
    expect(counts.syncPost).toBe(3);
  });

  it("keeps a newer snapshot when an older snapshot response arrives later", async () => {
    let releaseStale;
    const counts = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ ok: true }),
      snapshot: async () => {
        if (counts.snapshot === 1) {
          return jsonResponse({ data: { campaigns: [{ id: "camp_1", name: "Boot" }] } });
        }
        if (counts.snapshot === 2) {
          return new Promise((resolve) => {
            releaseStale = () => resolve(jsonResponse({
              data: { campaigns: [{ id: "camp_1", name: "Stale" }] },
            }));
          });
        }
        return jsonResponse({ data: { campaigns: [{ id: "camp_1", name: "Newer" }] } });
      },
      syncPost: async () => jsonResponse({ ok: true, status: healthy().sync }),
    });

    const boot = await bootstrapDurableStore();
    const staleFollowUp = boot.reconcile;
    await vi.waitFor(() => expect(counts.snapshot).toBe(2));
    const newer = refreshOperationalSnapshot();
    await newer;
    expect(listCollection("campaigns")[0].name).toBe("Newer");
    releaseStale();
    await staleFollowUp;
    expect(listCollection("campaigns")[0].name).toBe("Newer");
  });

  it("stays on the local snapshot when cloud reconcile fails and does not retry", async () => {
    const counts = installFetch({
      health: async () => jsonResponse(healthy({
        cloudReachable: false,
        state: "OFFLINE",
      })),
      migrate: async () => jsonResponse({ ok: true, skipped: true }),
      snapshot: async () => jsonResponse({ data: { campaigns: [{ id: "camp_local", name: "Local" }] } }),
      syncPost: async () => {
        throw new Error("turso down");
      },
    });

    const boot = await bootstrapDurableStore();
    expect(boot.ok).toBe(true);
    expect(listCollection("campaigns")[0].name).toBe("Local");
    await boot.reconcile;
    await settle();
    expect(counts).toEqual({ health: 1, migrate: 1, snapshot: 1, syncPost: 1, syncGet: 0 });
  });

  it("does not continue boot when health, migration, or the snapshot fails", async () => {
    const healthFail = installFetch({
      health: async () => {
        throw new Error("health down");
      },
      migrate: async () => jsonResponse({ ok: true }),
      snapshot: async () => jsonResponse({ data: {} }),
      syncPost: async () => jsonResponse({ ok: true }),
    });
    const healthResult = await bootstrapDurableStore();
    expect(healthResult.ok).toBe(false);
    expect(healthFail).toMatchObject({ health: 1, migrate: 0, snapshot: 0, syncPost: 0 });

    resetDurableHealthForTests();
    const migrateFail = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ error: "migration failed" }, false),
      snapshot: async () => jsonResponse({ data: {} }),
      syncPost: async () => jsonResponse({ ok: true }),
    });
    const migrateResult = await bootstrapDurableStore();
    expect(migrateResult.ok).toBe(false);
    expect(migrateFail).toMatchObject({ health: 1, migrate: 1, snapshot: 0, syncPost: 0 });

    resetDurableHealthForTests();
    const snapshotFail = installFetch({
      health: async () => jsonResponse(healthy()),
      migrate: async () => jsonResponse({ ok: true }),
      snapshot: async () => jsonResponse({ error: "snapshot failed" }, false),
      syncPost: async () => jsonResponse({ ok: true }),
    });
    const snapshotResult = await bootstrapDurableStore();
    expect(snapshotResult.ok).toBe(false);
    expect(snapshotFail).toMatchObject({ health: 1, migrate: 1, snapshot: 1, syncPost: 0 });
    await settle();
    expect(snapshotFail.syncPost).toBe(0);
  });
});
