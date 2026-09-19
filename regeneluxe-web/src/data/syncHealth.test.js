import { describe, expect, it } from "vitest";
import { displayCloudDatabaseStatus, displayCloudSyncStatus } from "./syncHealth.js";

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
