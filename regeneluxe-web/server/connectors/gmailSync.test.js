import { describe, expect, it } from "vitest";
import {
  applyGmailSyncOutcome,
  displayGmailJobStatus,
  gmailBrainSignals,
  GMAIL_SYNC_MAX_MESSAGES,
  GMAIL_SYNC_WINDOW_DAYS,
  nextGmailSyncCursor,
  normalizeGmailMessage,
  publicGmailMessage,
} from "./gmailSync.js";
import { friendlyGoogleApiError, googleApiDisabledMessage, googleRevokedMessage } from "../auth/googleErrors.js";
import { sanitizeAiContext } from "../../src/data/ai/validator.js";
import { buildBrainInput } from "../../src/data/ai/campaignBrain.js";

describe("gmail privacy and bounds", () => {
  it("keeps Campaign Brain on connection signals only", () => {
    const brain = gmailBrainSignals({
      status: "CONNECTED",
      lastSuccessfulSyncAt: "2024-04-01T00:00:00.000Z",
      snippet: "private body",
      body: "secret",
    });
    expect(brain).toEqual({
      gmailConnected: true,
      gmailLastSyncAt: "2024-04-01T00:00:00.000Z",
      gmailFreshness: "2024-04-01T00:00:00.000Z",
    });
    expect(JSON.stringify(brain)).not.toContain("secret");
    expect(JSON.stringify(brain)).not.toContain("private body");
  });

  it("redacts Gmail records from Campaign Brain input", () => {
    const leaky = sanitizeAiContext({
      gmail: {
        status: "CONNECTED",
        subject: "Show tonight",
        from: "fan@example.com",
        to: "djcoast239@gmail.com",
        snippet: "see you at 10",
        body: "full body",
        lastSuccessfulSyncAt: "2024-04-01T00:00:00.000Z",
      },
      gmail_messages: [{ providerMessageId: "m1", subject: "nope" }],
      messages: [{ provider: "gmail", providerMessageId: "m2", subject: "hidden" }],
    });
    expect(leaky.gmail).toEqual({
      gmailConnected: true,
      gmailLastSyncAt: "2024-04-01T00:00:00.000Z",
      gmailFreshness: "2024-04-01T00:00:00.000Z",
    });
    expect(leaky.gmail_messages).toBeUndefined();
    expect(leaky.messages).toEqual([]);
    const input = buildBrainInput({ id: "camp_1", accountIds: [] }, [], {
      gmail: {
        status: "CONNECTED",
        subject: "private",
        from: "fan@example.com",
        snippet: "secret",
        lastSuccessfulSyncAt: "2024-04-01T00:00:00.000Z",
      },
    });
    expect(input.gmail).toEqual({
      gmailConnected: true,
      gmailLastSyncAt: "2024-04-01T00:00:00.000Z",
      gmailFreshness: "2024-04-01T00:00:00.000Z",
    });
    expect(JSON.stringify(input)).not.toContain("private");
    expect(JSON.stringify(input)).not.toContain("fan@example.com");
    expect(JSON.stringify(input)).not.toContain("secret");
  });

  it("omits bodies from public gmail message records", () => {
    const row = publicGmailMessage({
      id: "gml_1",
      managedProfileId: "prf_1",
      providerMessageId: "m1",
      threadId: "t1",
      from: "a@x.com",
      to: "b@x.com",
      cc: "c@x.com",
      subject: "Hi",
      timestamp: "2024-04-01T00:00:00.000Z",
      labels: ["INBOX"],
      snippet: "hello",
      hasAttachments: false,
      body: "nope",
    });
    expect(row.body).toBeUndefined();
    expect(row.provider).toBe("gmail");
    expect(row.cc).toBe("c@x.com");
    expect(row.snippet).toBe("hello");
  });

  it("normalizes metadata without MIME payloads", () => {
    const record = normalizeGmailMessage({
      id: "m9",
      threadId: "t9",
      snippet: "hello",
      internalDate: "1710000000000",
      historyId: "42",
      labelIds: ["INBOX"],
      payload: {
        headers: [
          { name: "From", value: "a@x.com" },
          { name: "To", value: "b@x.com" },
          { name: "Cc", value: "c@x.com" },
          { name: "Subject", value: "Hi" },
          { name: "Date", value: "Wed, 10 Apr 2024 12:00:00 -0400" },
        ],
        parts: [{ filename: "mix.mp3", body: { attachmentId: "att" } }],
      },
    }, {
      connection: { id: "pcn_1", managedProfileId: "prf_1", ownerOperatorId: "opr_1" },
    });
    expect(record.provider).toBe("gmail");
    expect(record.providerMessageId).toBe("m9");
    expect(record.cc).toBe("c@x.com");
    expect(record.attachmentCount).toBe(1);
    expect(record.hasAttachments).toBe(true);
    expect(record.providerHistoryId).toBe("42");
    expect(record.body).toBeUndefined();
    expect(record.payload).toBeUndefined();
    expect(record.accessToken).toBeUndefined();
  });

  it("uses a 30-day window and 500-message cap", () => {
    expect(GMAIL_SYNC_WINDOW_DAYS).toBe(30);
    expect(GMAIL_SYNC_MAX_MESSAGES).toBe(500);
  });

  it("persists a list cursor when the max is reached", () => {
    const cursor = nextGmailSyncCursor(
      { reachedCap: true, nextPageToken: "page2", ids: Array.from({ length: 500 }, (_, i) => `m${i}`) },
      { historyId: "hist-1" },
      {},
    );
    expect(cursor).toEqual({
      listPageToken: "page2",
      historyId: "hist-1",
      reachedCap: true,
    });
  });

  it("maps job states for Data & Sync", () => {
    expect(displayGmailJobStatus(null)).toBe("Idle");
    expect(displayGmailJobStatus({ state: "RUNNING" })).toBe("Syncing");
    expect(displayGmailJobStatus({ state: "ERROR" })).toBe("Retry");
    expect(displayGmailJobStatus({ state: "FAILED" })).toBe("Error");
    expect(displayGmailJobStatus({ state: "DONE" })).toBe("Idle");
  });

  it("keeps CONNECTED on retryable Google failures", () => {
    const next = applyGmailSyncOutcome({
      status: "CONNECTED",
      indexedCount: 12,
    }, {
      ok: false,
      retryable: true,
      connectionState: "ERROR",
      error: "Gmail is temporarily unavailable. ReGeneLuxe will retry.",
      lastAttemptedSyncAt: "2024-04-01T00:00:00.000Z",
    });
    expect(next.status).toBe("CONNECTED");
    expect(next.jobStatus).toBe("Retry");
    expect(next.indexedCount).toBe(12);
  });

  it("records a partial indexed count after a retryable stop", () => {
    const next = applyGmailSyncOutcome({
      status: "CONNECTED",
      indexedCount: 0,
    }, {
      ok: false,
      retryable: true,
      created: 309,
      indexedCount: 309,
      connectionState: "ERROR",
      error: "Gmail is temporarily unavailable. ReGeneLuxe will retry.",
    });
    expect(next.status).toBe("CONNECTED");
    expect(next.indexedCount).toBe(309);
    expect(next.jobStatus).toBe("Retry");
    expect(next.lastSuccessfulSyncAt).toBeTruthy();
  });
});

describe("friendly Google API errors", () => {
  it("translates disabled APIs, revocations, and temporary failures", () => {
    expect(googleApiDisabledMessage("gmail")).toBe("Gmail API needs to be enabled for the ReGeneLuxe Google Cloud project.");
    expect(googleApiDisabledMessage("youtube")).toMatch(/YouTube Data API must be enabled/i);
    expect(googleRevokedMessage("Gmail")).toBe("Gmail access was revoked. Reconnect Gmail to continue syncing.");
    const disabled = friendlyGoogleApiError({
      error: { message: "Gmail API has not been used in project 1 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }] },
    }, 403, "gmail");
    expect(disabled.connectionState).toBe("SETUP_REQUIRED");
    expect(disabled.error).toBe("Gmail API needs to be enabled for the ReGeneLuxe Google Cloud project.");
    expect(disabled.error).not.toMatch(/accessNotConfigured/);
    const revoked = friendlyGoogleApiError({ error: { message: "invalid credentials" } }, 401, "gmail");
    expect(revoked.connectionState).toBe("RECONNECT_REQUIRED");
    expect(revoked.error).toBe("Gmail access was revoked. Reconnect Gmail to continue syncing.");
    const limited = friendlyGoogleApiError({ error: { message: "rateLimitExceeded" } }, 429, "gmail");
    expect(limited.retryable).toBe(true);
    expect(limited.error).toBe("Gmail is temporarily unavailable. ReGeneLuxe will retry.");
    const down = friendlyGoogleApiError({ error: { message: "backend error" } }, 503, "gmail");
    expect(down.retryable).toBe(true);
    expect(down.error).toBe("Gmail is temporarily unavailable. ReGeneLuxe will retry.");
  });
});
