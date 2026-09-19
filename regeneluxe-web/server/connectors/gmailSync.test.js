import { describe, expect, it } from "vitest";
import { gmailBrainSignals, GMAIL_SYNC_MAX_MESSAGES, GMAIL_SYNC_WINDOW_DAYS, publicGmailMessage } from "./gmailSync.js";
import { friendlyGoogleApiError, googleApiDisabledMessage, googleRevokedMessage } from "../auth/googleErrors.js";

describe("gmail privacy and bounds", () => {
  it("keeps Campaign Brain on connection signals only", () => {
    const brain = gmailBrainSignals({
      status: "CONNECTED",
      lastSuccessfulSyncAt: "2024-04-01T00:00:00.000Z",
      snippet: "private body",
      body: "secret",
    }, 4);
    expect(brain).toEqual({
      connected: true,
      lastSync: "2024-04-01T00:00:00.000Z",
      indexedCount: 4,
      permission: "readonly",
    });
    expect(JSON.stringify(brain)).not.toContain("secret");
    expect(JSON.stringify(brain)).not.toContain("private body");
  });

  it("omits bodies from public gmail message records", () => {
    const row = publicGmailMessage({
      id: "gml_1",
      managedProfileId: "prf_1",
      providerMessageId: "m1",
      threadId: "t1",
      from: "a@x.com",
      to: "b@x.com",
      subject: "Hi",
      timestamp: "2024-04-01T00:00:00.000Z",
      labels: ["INBOX"],
      snippet: "hello",
      hasAttachments: false,
      body: "nope",
    });
    expect(row.body).toBeUndefined();
    expect(row.snippet).toBe("hello");
  });

  it("uses a conservative 30-day window and 80-message cap", () => {
    expect(GMAIL_SYNC_WINDOW_DAYS).toBe(30);
    expect(GMAIL_SYNC_MAX_MESSAGES).toBe(80);
  });
});

describe("friendly Google API errors", () => {
  it("translates disabled APIs and revocations", () => {
    expect(googleApiDisabledMessage("gmail")).toMatch(/Gmail API is not enabled/i);
    expect(googleApiDisabledMessage("youtube")).toMatch(/YouTube Data API must be enabled/i);
    expect(googleRevokedMessage("Gmail")).toMatch(/Reconnect the Gmail account/i);
    const disabled = friendlyGoogleApiError({
      error: { message: "Gmail API has not been used in project 1 before or it is disabled.", errors: [{ reason: "accessNotConfigured" }] },
    }, 403, "gmail");
    expect(disabled.connectionState).toBe("SETUP_REQUIRED");
    expect(disabled.error).not.toMatch(/accessNotConfigured/);
    const revoked = friendlyGoogleApiError({ error: { message: "invalid credentials" } }, 401, "gmail");
    expect(revoked.connectionState).toBe("RECONNECT_REQUIRED");
  });
});
