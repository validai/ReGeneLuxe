import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PROFILE_IMAGE_MAX_BYTES } from "../../src/data/profileImage.js";

describe("local media store", () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "rl-media-"));
    process.env.RL_MEDIA_DIR = dir;
  });

  afterEach(() => {
    delete process.env.RL_MEDIA_DIR;
    rmSync(dir, { recursive: true, force: true });
  });

  it("stores bytes on disk and returns a media reference, not a data URL", async () => {
    const { saveProfileImageBuffer, readLocalMedia } = await import("./store.js");
    const buffer = Buffer.alloc(411_229, 7);
    buffer[0] = 0x89;
    buffer[1] = 0x50;
    buffer[2] = 0x4e;
    buffer[3] = 0x47;
    buffer[4] = 0x0d;
    buffer[5] = 0x0a;
    buffer[6] = 0x1a;
    buffer[7] = 0x0a;
    const saved = await saveProfileImageBuffer({
      buffer,
      mimeType: "image/png",
      originalName: "DJ-Coast.png",
    });
    expect(saved.url).toBe(`/api/media/${saved.id}`);
    expect(saved.url.startsWith("data:")).toBe(false);
    expect(saved.bytes).toBe(411_229);
    const read = readLocalMedia(saved.id);
    expect(read.buffer.length).toBe(411_229);
    expect(read.mimeType).toBe("image/png");
  });

  it("rejects oversized buffers using raw byte length", async () => {
    const { saveProfileImageBuffer } = await import("./store.js");
    const buffer = Buffer.alloc(PROFILE_IMAGE_MAX_BYTES + 1);
    await expect(saveProfileImageBuffer({
      buffer,
      mimeType: "image/jpeg",
      originalName: "big.jpg",
    })).rejects.toThrow(/maximum size is 500 kb/i);
  });
});
