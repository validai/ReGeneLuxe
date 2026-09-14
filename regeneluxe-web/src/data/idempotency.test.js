import { describe, expect, it } from "vitest";
import { publicationIdempotencyKey } from "./idempotency.js";

describe("publish idempotency", () => {
  it("is stable for the same content/account/schedule", () => {
    const a = publicationIdempotencyKey({
      contentId: "c1",
      accountId: "a1",
      scheduledAt: "2026-06-01T15:00:00.000Z",
    });
    const b = publicationIdempotencyKey({
      contentId: "c1",
      accountId: "a1",
      scheduledAt: "2026-06-01T15:00:00.000Z",
    });
    expect(a).toBe(b);
  });

  it("changes when schedule changes", () => {
    const a = publicationIdempotencyKey({
      contentId: "c1",
      accountId: "a1",
      scheduledAt: "2026-06-01T15:00:00.000Z",
    });
    const b = publicationIdempotencyKey({
      contentId: "c1",
      accountId: "a1",
      scheduledAt: "2026-06-01T16:00:00.000Z",
    });
    expect(a).not.toBe(b);
  });
});
