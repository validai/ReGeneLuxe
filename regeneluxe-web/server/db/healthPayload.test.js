import { afterEach, describe, expect, it } from "vitest";
import { toClientDbHealth, tursoConfiguredFromEnv } from "./healthPayload.js";

describe("toClientDbHealth", () => {
  const originalUrl = process.env.TURSO_DATABASE_URL;
  const originalToken = process.env.TURSO_AUTH_TOKEN;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
    else process.env.TURSO_DATABASE_URL = originalUrl;
    if (originalToken === undefined) delete process.env.TURSO_AUTH_TOKEN;
    else process.env.TURSO_AUTH_TOKEN = originalToken;
  });

  it("passes through configured + synced Turso including cloudReachable", () => {
    const payload = toClientDbHealth({
      ok: true,
      mode: "file",
      schemaVersion: 4,
      sync: {
        cloudConfigured: true,
        cloudReachable: true,
        state: "SYNCED",
        lastSyncAt: "2026-09-19T21:06:24.112Z",
        pendingOutbox: 0,
        pendingJobs: 0,
        localHealthy: true,
      },
    });
    expect(payload.ok).toBe(true);
    expect(payload.local.healthy).toBe(true);
    expect(payload.sync.cloudConfigured).toBe(true);
    expect(payload.sync.cloudReachable).toBe(true);
    expect(payload.sync.state).toBe("SYNCED");
    expect(payload.sync.pendingOutbox).toBe(0);
    expect(payload.fetchFailed).toBe(false);
  });

  it("keeps configured Turso as Offline on a thrown health probe, not Not configured", () => {
    process.env.TURSO_DATABASE_URL = "libsql://example.turso.io";
    process.env.TURSO_AUTH_TOKEN = "test-token";
    const payload = toClientDbHealth(null, { fetchFailed: true, error: "init failed" });
    expect(tursoConfiguredFromEnv()).toBe(true);
    expect(payload.fetchFailed).toBe(true);
    expect(payload.sync.cloudConfigured).toBe(true);
    expect(payload.sync.cloudReachable).toBe(false);
    expect(payload.sync.state).toBe("OFFLINE");
  });

  it("labels absent Turso env as not configured", () => {
    delete process.env.TURSO_DATABASE_URL;
    delete process.env.TURSO_AUTH_TOKEN;
    const payload = toClientDbHealth({
      ok: true,
      sync: {
        cloudConfigured: false,
        cloudReachable: false,
        state: "LOCAL_ONLY",
        pendingOutbox: 0,
        localHealthy: true,
      },
    });
    expect(payload.sync.cloudConfigured).toBe(false);
    expect(payload.sync.state).toBe("LOCAL_ONLY");
  });
});
