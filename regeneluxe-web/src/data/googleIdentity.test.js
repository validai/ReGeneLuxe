import { describe, expect, it } from "vitest";
import {
  assertMatchesSignedInGoogleAccount,
  displayAccountEmail,
  displayOperatorEmail,
  GOOGLE_ACCOUNT_MISMATCH_MESSAGE,
  googleEmailsMatch,
  googleSubsMatch,
  normalizeGoogleEmail,
} from "./googleIdentity.js";

describe("ReGeneLuxe account Google identity", () => {
  it("normalizes emails without treating infrastructure identity as runtime", () => {
    expect(normalizeGoogleEmail(" DJCoast239@gmail.com ")).toBe("djcoast239@gmail.com");
    expect(googleEmailsMatch("djcoast239@gmail.com", "DJCoast239@gmail.com")).toBe(true);
    expect(googleEmailsMatch("validsstudio@gmail.com", "djcoast239@gmail.com")).toBe(false);
  });

  it("displays the signed-in account email", () => {
    expect(displayAccountEmail({ email: "DJCoast239@gmail.com" })).toBe("djcoast239@gmail.com");
    expect(displayOperatorEmail({ email: "DJCoast239@gmail.com" })).toBe("djcoast239@gmail.com");
  });

  it("matches Google sub independently of email casing", () => {
    expect(googleSubsMatch("sub-1", "sub-1")).toBe(true);
    expect(googleSubsMatch("sub-1", "sub-2")).toBe(false);
  });

  it("accepts Gmail/YouTube OAuth for the same signed-in Google account", () => {
    const account = { googleSub: "sub-coast", email: "djcoast239@gmail.com" };
    expect(assertMatchesSignedInGoogleAccount(account, {
      googleSub: "sub-coast",
      email: "djcoast239@gmail.com",
    }).ok).toBe(true);
  });

  it("rejects a mismatched Google sub without silent attach", () => {
    const result = assertMatchesSignedInGoogleAccount(
      { googleSub: "sub-coast", email: "djcoast239@gmail.com" },
      { googleSub: "other-sub", email: "other@gmail.com" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe(GOOGLE_ACCOUNT_MISMATCH_MESSAGE);
  });
});
