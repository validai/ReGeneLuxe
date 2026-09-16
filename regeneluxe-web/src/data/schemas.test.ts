import { describe, expect, it } from "vitest";
import { ContentStatusSchema, PlatformSchema } from "./schemas";
import { readServerEnv } from "./env";

describe("domain schemas", () => {
  it("accepts known content statuses", () => {
    expect(ContentStatusSchema.parse("READY")).toBe("READY");
    expect(() => ContentStatusSchema.parse("NOPE")).toThrow();
  });

  it("accepts platforms", () => {
    expect(PlatformSchema.parse("Instagram")).toBe("Instagram");
    expect(PlatformSchema.parse("Snapchat")).toBe("Snapchat");
    expect(PlatformSchema.parse("Twitch")).toBe("Twitch");
    expect(PlatformSchema.parse("Kick")).toBe("Kick");
  });

  it("parses optional server env", () => {
    const env = readServerEnv({ NODE_ENV: "test", REGENELUXE_UI_PORT: "5174" });
    expect(env.REGENELUXE_UI_PORT).toBe("5174");
  });
});
