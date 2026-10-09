import { describe, expect, it } from "vitest";
import { accountPreviewMode, isAccountPreviewEnabled } from "./accountPreview.js";

describe("account preview guard", () => {
  it("allows the accepted preview states outside production", () => {
    expect(isAccountPreviewEnabled("development")).toBe(true);
    expect(isAccountPreviewEnabled("test")).toBe(true);
    for (const mode of ["picker", "instagram", "destinations", "manual", "connected"]) {
      expect(accountPreviewMode(mode, "development")).toBe(mode);
    }
  });

  it("ignores every preview parameter in production", () => {
    expect(isAccountPreviewEnabled("production")).toBe(false);
    for (const mode of ["picker", "instagram", "destinations", "manual", "connected"]) {
      expect(accountPreviewMode(mode, "production")).toBe("");
    }
  });
});
