import { describe, expect, it } from "vitest";
import { validateProfileSetupFields } from "./profileForm.js";

const valid = {
  displayName: "DJ Coast",
  slug: "dj-coast",
  primaryEmail: "djcoast239@gmail.com",
  primaryPublicUrl: "https://www.youtube.com/@CoastEntertainment",
  website: "",
  platforms: ["YouTube"],
};

describe("profile setup field diagnostics", () => {
  it("accepts a blank optional website", () => {
    const result = validateProfileSetupFields(valid);
    expect(result.errors.website).toBe("");
    expect(result.count).toBe(0);
  });

  it("shows an email error for an invalid address", () => {
    const result = validateProfileSetupFields({ ...valid, primaryEmail: "not-an-email" });
    expect(result.errors.primaryEmail).toBe("Enter a valid email address.");
    expect(result.errors.website).toBe("");
  });

  it("shows a URL error for a public link missing http(s)", () => {
    const result = validateProfileSetupFields({ ...valid, primaryPublicUrl: "youtube.com/@x" });
    expect(result.errors.primaryPublicUrl).toBe("Enter a complete URL beginning with http:// or https://.");
  });

  it("requires a profile name, slug, and at least one platform", () => {
    const result = validateProfileSetupFields({
      displayName: "",
      slug: "Bad Slug",
      primaryEmail: "ok@example.com",
      primaryPublicUrl: "https://example.com",
      website: "",
      platforms: [],
    });
    expect(result.errors.displayName).toBe("Enter a profile name.");
    expect(result.errors.slug).toBe("Use letters, numbers, and hyphens only.");
    expect(result.errors.platforms).toBe("Select at least one platform.");
    expect(result.summary).toBe("Please fix 3 fields before saving.");
  });

  it("keeps image errors on the avatar field only", () => {
    const result = validateProfileSetupFields(valid, {
      imageError: "PNG, JPG, or WebP images are supported.",
    });
    expect(result.errors.avatar).toMatch(/png, jpg, or webp/i);
    expect(result.invalidKeys).toEqual(["avatar"]);
  });
});
