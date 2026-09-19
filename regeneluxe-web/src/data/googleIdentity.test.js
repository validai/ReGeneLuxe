import { describe, expect, it } from "vitest";
import {
  PILOT_GOOGLE_EMAIL,
  assertMatchesBoundGoogleIdentity,
  displayGoogleIdentity,
  googleIdentityMismatchMessage,
} from "./googleIdentity.js";

describe("single Google identity", () => {
  it("accepts the bound Google principal", () => {
    expect(assertMatchesBoundGoogleIdentity(
      { googleAccountEmail: PILOT_GOOGLE_EMAIL, googleAccountSub: "sub-1" },
      { email: "DJCoast239@gmail.com", googleSub: "sub-1" },
    ).ok).toBe(true);
  });

  it("rejects a different Google account without swapping identity", () => {
    const result = assertMatchesBoundGoogleIdentity(
      { googleAccountEmail: PILOT_GOOGLE_EMAIL, googleAccountSub: "sub-1" },
      { email: "validsstudio@gmail.com", googleSub: "other-sub" },
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe(googleIdentityMismatchMessage(PILOT_GOOGLE_EMAIL));
    expect(result.error).toMatch(/djcoast239@gmail.com/);
  });

  it("displays the bound profile email instead of a second operator identity", () => {
    expect(displayGoogleIdentity(
      { googleAccountEmail: PILOT_GOOGLE_EMAIL },
      { email: "validsstudio@gmail.com", name: "Valid" },
    )).toBe(PILOT_GOOGLE_EMAIL);
  });
});
