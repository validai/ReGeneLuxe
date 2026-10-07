import { describe, expect, it } from "vitest";
import {
  countLabel,
  displayCloudDatabaseStatus,
  displayCloudSyncStatus,
  formatDataSyncDisplay,
  formatSyncLine,
  formatWorkspaceSummary,
  mergeHealthWithSyncStatus,
} from "./syncHealth.js";

describe("cloud sync health labels", () => {
  it("does not call configured Turso 'Offline (not configured)'", () => {
    const sync = {
      cloudConfigured: true,
      cloudReachable: true,
      state: "SYNCED",
      pendingOutbox: 0,
      localHealthy: true,
    };
    expect(displayCloudDatabaseStatus(sync)).toBe("Connected");
    expect(displayCloudSyncStatus(sync)).toBe("Synced");
    expect(displayCloudDatabaseStatus(sync)).not.toBe("Offline (not configured)");
    expect(displayCloudSyncStatus(sync)).not.toBe("Offline (not configured)");
  });

  it("labels pending outbox as Connected + Pending", () => {
    const sync = {
      cloudConfigured: true,
      cloudReachable: true,
      state: "PENDING",
      pendingOutbox: 3,
      localHealthy: true,
    };
    expect(displayCloudDatabaseStatus(sync)).toBe("Connected");
    expect(displayCloudSyncStatus(sync)).toBe("Pending");
  });

  it("labels configured-but-unreachable Turso as Offline", () => {
    const sync = {
      cloudConfigured: true,
      cloudReachable: false,
      state: "OFFLINE",
      pendingOutbox: 0,
      localHealthy: true,
    };
    expect(displayCloudDatabaseStatus(sync)).toBe("Offline");
    expect(displayCloudSyncStatus(sync)).toBe("Offline");
    expect(displayCloudDatabaseStatus(sync)).not.toBe("Not configured");
    expect(displayCloudDatabaseStatus(sync)).not.toBe("Offline (not configured)");
  });

  it("labels absent Turso env as Not configured / Local only", () => {
    const sync = {
      cloudConfigured: false,
      cloudReachable: false,
      state: "LOCAL_ONLY",
      pendingOutbox: 0,
      localHealthy: true,
    };
    expect(displayCloudDatabaseStatus(sync)).toBe("Not configured");
    expect(displayCloudSyncStatus(sync)).toBe("Local only");
  });
});

describe("formatDataSyncDisplay", () => {
  it("does not show Healthy or a bare dash while health is still loading", () => {
    const rows = formatDataSyncDisplay(null);
    expect(formatSyncLine(rows.local)).toBe("— (Waiting for database health)");
    expect(formatSyncLine(rows.cloud)).toBe("— (Waiting for database health)");
    expect(formatSyncLine(rows.sync)).toBe("— (Waiting for database health)");
    expect(formatSyncLine(rows.pending)).toBe("— (Waiting for database health)");
    expect(formatSyncLine(rows.local)).not.toBe("Healthy");
  });

  it("keeps authoritative Connected/Synced instead of a dash", () => {
    const rows = formatDataSyncDisplay({
      ok: true,
      local: { healthy: true },
      sync: {
        cloudConfigured: true,
        cloudReachable: true,
        state: "SYNCED",
        pendingOutbox: 0,
        lastSyncAt: "2026-09-19T21:06:24.112Z",
        localHealthy: true,
      },
    });
    expect(formatSyncLine(rows.local)).toBe("Healthy");
    expect(formatSyncLine(rows.cloud)).toBe("Connected");
    expect(formatSyncLine(rows.sync)).toBe("Synced");
    expect(formatSyncLine(rows.pending)).toBe("0");
    expect(formatSyncLine(rows.cloud)).not.toContain("—");
  });

  it("does not call a health fetch failure Not configured", () => {
    const rows = formatDataSyncDisplay({
      ok: false,
      fetchFailed: true,
      error: "Failed to fetch",
      local: { healthy: null, error: "Failed to fetch" },
      sync: { cloudConfigured: null, state: "UNKNOWN", error: "Failed to fetch", pendingOutbox: null },
    });
    expect(formatSyncLine(rows.cloud)).toMatch(/^— \(/);
    expect(formatSyncLine(rows.cloud)).toMatch(/Failed to fetch/);
    expect(formatSyncLine(rows.cloud)).not.toBe("Not configured");
    expect(formatSyncLine(rows.local)).not.toBe("Healthy");
  });

  it("does not leave Syncing after a completed request with an empty outbox", () => {
    expect(displayCloudSyncStatus({
      cloudConfigured: true,
      cloudReachable: true,
      state: "SYNCING",
      pendingOutbox: 0,
    })).toBe("Synced");
    expect(displayCloudSyncStatus({
      cloudConfigured: true,
      cloudReachable: true,
      state: "SYNCED",
      pendingOutbox: 0,
    }, { inFlight: true })).toBe("Syncing");
  });

  it("uses singular and plural workspace counts", () => {
    expect(countLabel(1, "social account")).toBe("1 social account");
    expect(countLabel(2, "social account")).toBe("2 social accounts");
    expect(formatWorkspaceSummary({
      brandName: "DJ Coast",
      campaignCount: 0,
      socialAccountCount: 1,
    })).toEqual({
      heading: "DJ Coast workspace",
      campaigns: "0 campaigns",
      socialAccounts: "1 social account",
    });
  });

  it("applies Sync now status onto existing health so the screen can refresh", () => {
    const merged = mergeHealthWithSyncStatus(
      {
        ok: true,
        local: { healthy: true },
        sync: {
          cloudConfigured: true,
          cloudReachable: true,
          state: "PENDING",
          pendingOutbox: 2,
          lastSyncAt: "2026-09-19T21:06:24.112Z",
        },
      },
      {
        cloudConfigured: true,
        cloudReachable: true,
        state: "SYNCED",
        pendingOutbox: 0,
        lastSyncAt: "2026-10-07T16:40:20.411Z",
      },
    );
    const rows = formatDataSyncDisplay(merged);
    expect(formatSyncLine(rows.sync)).toBe("Synced");
    expect(formatSyncLine(rows.pending)).toBe("0");
    expect(merged.sync.lastSyncAt).toBe("2026-10-07T16:40:20.411Z");
  });
});
