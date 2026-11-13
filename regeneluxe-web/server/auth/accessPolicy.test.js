import { describe, expect, it } from "vitest";
import {
  evaluateAppAccess,
  getAccessMode,
  operatorHasAppAccess,
  ACCESS_MODE_LOCAL,
  ACCESS_MODE_PRIVATE_PILOT,
} from "./accessPolicy.js";

describe("app-level access policy", () => {
  it("defaults localhost AUTH_URL to local mode", () => {
    expect(getAccessMode({ env: { AUTH_URL: "http://localhost:5174" } })).toBe(ACCESS_MODE_LOCAL);
  });

  it("allows any verified email in local mode without profile parent invites", () => {
    const result = evaluateAppAccess("sixd@gmail.com", {
      env: { REGENELUXE_ACCESS_MODE: "local" },
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe(ACCESS_MODE_LOCAL);
  });

  it("denies unauthorized emails in private pilot mode", () => {
    const result = evaluateAppAccess("stranger@gmail.com", {
      env: {
        REGENELUXE_ACCESS_MODE: "private_pilot",
        APP_ALLOWED_GOOGLE_EMAILS: "pilot@example.com",
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("not_authorized");
    expect(result.mode).toBe(ACCESS_MODE_PRIVATE_PILOT);
  });

  it("does not honor obsolete PROFILE_INVITE grants", () => {
    expect(operatorHasAppAccess({
      email: "x@y.com",
      status: "ACTIVE",
      pilotAccessGrant: "PROFILE_INVITE",
      appAccessGrant: "",
    }, {
      env: {
        REGENELUXE_ACCESS_MODE: "private_pilot",
        APP_ALLOWED_GOOGLE_EMAILS: "pilot@example.com",
      },
    })).toBe(false);
  });
});
