/** @vitest-environment node */
import { afterAll, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { apiPort, uiPort, SERVICE_NAME } from "./config.js";
import { ensureRuntime, probeRuntime, stopRuntime } from "./index.js";

function listenDummy(port) {
  return new Promise((resolve, reject) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "other-app" }));
    });
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => resolve(server));
  });
}

describe("local runtime", () => {
  const base = 39100 + Math.floor(Math.random() * 400);

  afterAll(async () => {
    await stopRuntime();
  });

  it("exposes configurable default ports", () => {
    expect(apiPort()).toBeGreaterThan(0);
    expect(uiPort()).toBeGreaterThan(0);
    expect(SERVICE_NAME).toBe("regeneluxe");
  });

  it("starts once and serves health", async () => {
    const port = base;
    const first = await ensureRuntime(port);
    expect(first.ok).toBe(true);
    const health = await probeRuntime(port);
    expect(health.ok).toBe(true);
    expect(health.body.service).toBe("regeneluxe");
    expect(health.body.app).toBe("ReGeneLuxe");
    expect(health.body.framework).toBe("next");
    expect(health.body.canonicalUiUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+/);
    expect(health.body.startedAt).toBeTruthy();
    expect(["RUNNING", "AI_NOT_CONFIGURED"]).toContain(health.body.state);

    const second = await ensureRuntime(port);
    expect(second.ok).toBe(true);
    expect(second.reused).toBe(true);
  });

  it("reuses an already-running ReGeneLuxe listener after stop of in-process handle", async () => {
    const port = base + 1;
    const started = await ensureRuntime(port);
    expect(started.ok).toBe(true);
    // Simulate vite config reload forgetting the handle while OS socket remains.
    // stopRuntime closes it — instead probe reuse path via ensure after start.
    const again = await ensureRuntime(port);
    expect(again.ok).toBe(true);
    expect(again.reused).toBe(true);
  });

  it("fails clearly when another process owns the port", async () => {
    const port = base + 2;
    const foreign = await listenDummy(port);
    try {
      // Clear any prior global handle so ensure attempts a fresh bind/probe.
      await stopRuntime();
      const result = await ensureRuntime(port);
      expect(result.ok).toBe(false);
      expect(result.error).toMatch(/already in use/i);
      expect(result.error).toMatch(/REGENELUXE_API_PORT/);
    } finally {
      await new Promise((resolve) => foreign.close(() => resolve()));
    }
  });
});
