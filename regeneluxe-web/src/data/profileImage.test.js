import { describe, expect, it } from "vitest";
import {
  PROFILE_IMAGE_MAX_BYTES,
  PROFILE_IMAGE_MAX_KB,
  encodedPayloadLength,
  formatBytesAsKb,
  sanitizeAvatarUrl,
  validateImageDimensions,
  validateProfileImageFile,
} from "./profileImage.js";

function fileOf(bytes, { name = "DJ-Coast.png", type = "image/png" } = {}) {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("profile image size uses raw File.size", () => {
  it("uses 500 × 1024 bytes as the canonical 500 KB limit", () => {
    expect(PROFILE_IMAGE_MAX_KB).toBe(500);
    expect(PROFILE_IMAGE_MAX_BYTES).toBe(500 * 1024);
  });

  it("accepts a 411,229-byte PNG under the raw-file limit", () => {
    const file = fileOf(411_229);
    expect(file.size).toBe(411_229);
    const result = validateProfileImageFile(file);
    expect(result.ok).toBe(true);
    expect(result.bytes).toBe(411_229);
  });

  it("does not reject because the base64 payload would exceed 500 KB", () => {
    const raw = 411_229;
    const encoded = encodedPayloadLength(raw);
    expect(encoded).toBeGreaterThan(500_000);
    expect(encoded).toBeGreaterThan(PROFILE_IMAGE_MAX_BYTES);
    expect(validateProfileImageFile(fileOf(raw)).ok).toBe(true);
  });

  it("rejects a file above the raw-file limit with the detected size", () => {
    const bytes = PROFILE_IMAGE_MAX_BYTES + 1;
    const result = validateProfileImageFile(fileOf(bytes));
    expect(result.ok).toBe(false);
    expect(result.code).toBe("size");
    expect(result.error).toBe(`Image is ${formatBytesAsKb(bytes)}. Maximum size is 500 KB.`);
    expect(result.error).not.toMatch(/choose an image under/i);
  });

  it("rejects SVG and other unsupported types with a MIME-specific error", () => {
    const svg = fileOf(1200, { name: "mark.svg", type: "image/svg+xml" });
    const result = validateProfileImageFile(svg);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("mime");
    expect(result.error).toBe("PNG, JPG, or WebP images are supported.");
    expect(result.error).not.toMatch(/500 KB/i);
  });

  it("treats a 500 × 500 image as valid dimensions", () => {
    expect(validateImageDimensions(500, 500)).toEqual({ ok: true, width: 500, height: 500 });
  });

  it("separates dimension errors from size errors", () => {
    expect(validateImageDimensions(128, 128).error).toBe("Image must be at least 256 × 256 pixels.");
    expect(validateImageDimensions(5000, 500).error).toBe("Image dimensions exceed the supported maximum.");
  });

  it("strips data-URL avatars from persisted profile records", () => {
    expect(sanitizeAvatarUrl("data:image/png;base64,AAAA")).toBe("");
    expect(sanitizeAvatarUrl("/api/media/med_1")).toBe("/api/media/med_1");
  });
});
