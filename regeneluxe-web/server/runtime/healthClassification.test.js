import { describe, expect, it } from "vitest";
import {
  classifyHealthComponents,
  describeHealthForOperator,
  OPTIONAL_COMPONENT_AI,
} from "./healthClassification.js";

describe("healthClassification", () => {
  it("keeps status OK when only optional AI is missing", () => {
    const result = classifyHealthComponents({
      localHealthy: true,
      aiConfigured: false,
      syncState: "SYNCED",
      schedulerEnabled: true,
      schedulerLastTickOk: true,
      productionRuntime: true,
    });
    expect(result.status).toBe("OK");
    expect(result.ok).toBe(true);
    expect(result.coreOperational).toBe(true);
    expect(result.degradedComponents).toEqual([]);
    expect(result.optionalComponents).toEqual([OPTIONAL_COMPONENT_AI]);
  });

  it("marks DEGRADED only for core failures, not missing AI", () => {
    const result = classifyHealthComponents({
      localHealthy: true,
      aiConfigured: false,
      syncState: "SYNCED",
      schedulerEnabled: true,
      schedulerLastTickOk: false,
      productionRuntime: true,
    });
    expect(result.status).toBe("DEGRADED");
    expect(result.degradedComponents).toContain("scheduler_last_tick_failed");
    expect(result.optionalComponents).toContain(OPTIONAL_COMPONENT_AI);
  });

  it("marks UNHEALTHY when the database is down", () => {
    const result = classifyHealthComponents({
      localHealthy: false,
      aiConfigured: true,
      productionRuntime: true,
    });
    expect(result.status).toBe("UNHEALTHY");
    expect(result.ok).toBe(false);
  });

  it("describes optional AI without sounding like a runtime failure", () => {
    const copy = describeHealthForOperator({
      status: "OK",
      aiConfigured: false,
      coreOperational: true,
    });
    expect(copy.coreLabel).toBe("Core system operational");
    expect(copy.aiLabel).toBe("Optional AI not configured");
    expect(copy.summary).toMatch(/does not block/i);
  });
});
