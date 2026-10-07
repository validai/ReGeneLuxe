import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDbHealth, resetDurableHealthForTests } from "./durableBootstrap.js";

describe("fetchDbHealth", () => {
  beforeEach(() => {
    resetDurableHealthForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetDurableHealthForTests();
  });

  it("uses /api/db/health as the sole source and keeps configured Turso on a later fetch failure", async () => {
    const calls = [];
    vi.stubGlobal("fetch", vi.fn(async (url) => {
      calls.push(String(url));
      return {
        ok: true,
        json: async () => ({
          ok: true,
          local: { healthy: true },
          sync: {
            cloudConfigured: true,
            cloudReachable: true,
            state: "SYNCED",
            pendingOutbox: 0,
            localHealthy: true,
          },
        }),
      };
    }));
    const first = await fetchDbHealth();
    expect(calls.some((url) => url.includes("/api/db/health"))).toBe(true);
    expect(calls.some((url) => url.includes("/api/sync"))).toBe(false);
    expect(first.sync.cloudConfigured).toBe(true);
    expect(first.sync.state).toBe("SYNCED");

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down");
    }));
    const second = await fetchDbHealth();
    expect(second.ok).toBe(false);
    expect(second.sync.cloudConfigured).toBe(true);
    expect(second.sync.cloudReachable).toBe(false);
    expect(second.sync.state).toBe("OFFLINE");
  });

  it("does not invent Not configured when the first health fetch fails", async () => {
    resetDurableHealthForTests();
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("Failed to fetch");
    }));
    const failed = await fetchDbHealth();
    expect(failed.fetchFailed).toBe(true);
    expect(failed.sync.cloudConfigured).toBeNull();
    expect(failed.sync.state).toBe("UNKNOWN");
    expect(failed.local.healthy).toBeNull();
  });
});
