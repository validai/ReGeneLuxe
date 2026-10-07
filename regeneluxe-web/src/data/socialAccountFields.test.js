import { describe, expect, it } from "vitest";
import { fieldsForPlatform, identityHintForPlatform } from "./socialAccountFields.js";

describe("platform-specific social account fields", () => {
  it("shows an identity field for Instagram and a note for LinkedIn", () => {
    expect(fieldsForPlatform("Instagram").identity).toBe(true);
    expect(identityHintForPlatform("Instagram")).toMatch(/@handle/i);
    expect(fieldsForPlatform("LinkedIn").note).toMatch(/unsupported/i);
    expect(fieldsForPlatform("Other")).toMatchObject({
      identity: false,
      displayName: true,
      handle: true,
      profileUrl: true,
    });
  });
});
