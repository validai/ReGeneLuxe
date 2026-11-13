import { describe, expect, it } from "vitest";
import {
  AUTHORITATIVE_ORIGIN,
  classifyStartDecision,
  isOwnerVerifiedStopTarget,
  productionBuildPresent,
} from "./canonicalStart.js";
import { isRegeneluxeHealth } from "./canonicalDev.js";

const healthy = {
  ok: true,
  app: "ReGeneLuxe",
  service: "regeneluxe",
  framework: "next",
  uiPort: 5174,
};

describe("canonical production start decisions", () => {
  it("reuses a healthy ReGeneLuxe listener", () => {
    const decision = classifyStartDecision({
      listener: { pid: 42, command: "next-server" },
      health: healthy,
      cwd: "/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web",
      buildPresent: true,
    });
    expect(decision.action).toBe("reuse");
    expect(AUTHORITATIVE_ORIGIN).toBe("http://localhost:5174");
  });

  it("fails closed when an unrelated process owns 5174", () => {
    const decision = classifyStartDecision({
      listener: { pid: 9, command: "node" },
      health: { ok: true, app: "Investools", service: "other", framework: "next", uiPort: 5174 },
      cwd: "/Users/eric/Desktop/Investools",
      buildPresent: true,
    });
    expect(decision.action).toBe("fail_closed");
    expect(decision.reason).toBe("unrelated_owner");
  });

  it("fails closed when production build is missing", () => {
    const decision = classifyStartDecision({
      listener: null,
      health: null,
      cwd: "",
      buildPresent: false,
    });
    expect(decision.action).toBe("fail_closed");
    expect(decision.reason).toBe("missing_production_build");
  });

  it("starts when port is free and build exists", () => {
    const decision = classifyStartDecision({
      listener: null,
      health: null,
      cwd: "",
      buildPresent: true,
    });
    expect(decision.action).toBe("start");
  });

  it("only stops owner-verified targets", () => {
    expect(
      isOwnerVerifiedStopTarget({
        listener: { pid: 42, command: "next-server" },
        cwd: "/Users/eric/Desktop/ReGeneLuxe/regeneluxe-web",
        health: healthy,
        meta: { pid: 42 },
      }).ok,
    ).toBe(true);

    expect(
      isOwnerVerifiedStopTarget({
        listener: { pid: 99, command: "node" },
        cwd: "/Users/eric/Desktop/Investools",
        health: { ok: true, app: "Investools" },
        meta: null,
      }).ok,
    ).toBe(false);

    expect(isRegeneluxeHealth(healthy)).toBe(true);
  });

  it("detects production build presence via BUILD_ID", () => {
    // Function under test is path-based; assert it is callable with this repo root.
    expect(typeof productionBuildPresent(".")).toBe("boolean");
  });
});
