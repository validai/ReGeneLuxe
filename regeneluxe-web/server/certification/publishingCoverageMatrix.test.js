import { describe, expect, it } from "vitest";
import {
  buildPublishingCoverageMatrix,
  PUBLISHING_COVERAGE_BASELINE,
} from "./publishingCoverageMatrix.js";

describe("publishingCoverageMatrix", () => {
  it("does not invent CERTIFIED or collapse provider API with ReGeneLuxe support", () => {
    const matrix = buildPublishingCoverageMatrix({
      credentialAuthorizedByProvider: { youtube: false },
      certifiedByKey: {},
    });
    const ytPrivate = matrix.rows.find((r) => r.key === "youtube::LONG_VIDEO_PRIVATE");
    expect(ytPrivate.SUPPORTED_BY_PROVIDER_API).toBe(true);
    expect(ytPrivate.SUPPORTED_BY_REGENELUXE).toBe(true);
    expect(ytPrivate.CURRENT_CREDENTIAL_AUTHORIZED).toBe(false);
    expect(ytPrivate.CERTIFIED).toBe(false);
    expect(ytPrivate.releaseStatus).toBe("YELLOW");
  });

  it("marks TikTok posting as BLOCKED_EXTERNAL until Content Posting API approval", () => {
    const tiktok = PUBLISHING_COVERAGE_BASELINE.find((r) => r.contentType === "VIDEO_DIRECT");
    expect(tiktok.provider).toBe("tiktok");
    expect(tiktok.SUPPORTED_BY_REGENELUXE).toBe(false);
    expect(tiktok.BLOCKED_EXTERNAL).toBeTruthy();
  });

  it("flags Instagram carousel as engineering gap when API supports and ReGeneLuxe does not", () => {
    const matrix = buildPublishingCoverageMatrix();
    const carousel = matrix.rows.find((r) => r.key === "instagram::CAROUSEL");
    expect(carousel.ENGINEERING_GAP).toBe(true);
    expect(carousel.releaseStatus).toBe("RED");
  });

  it("exposes war-room content-type priority order", () => {
    const matrix = buildPublishingCoverageMatrix();
    expect(matrix.warRoomPriority[0]).toBe("youtube::LONG_VIDEO_PRIVATE");
    expect(matrix.warRoomPriority).toContain("instagram::REEL");
  });
});
