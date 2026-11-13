import { describe, expect, it } from "vitest";
import { isE2eAuthEnabled, isE2eDisposableEmail } from "./e2eAuthGate.js";

describe("e2e auth gate", () => {
  it("stays closed for managed canonical runtime", () => {
    expect(isE2eAuthEnabled({
      REGENELUXE_E2E_AUTH: "1",
      REGENELUXE_E2E_SECRET: "secret",
      REGENELUXE_E2E_ALLOW_PRODUCTION: "1",
      NODE_ENV: "production",
      RL_RUNTIME_MANAGED: "1",
    })).toBe(false);
  });

  it("requires disposable invalid emails", () => {
    expect(isE2eDisposableEmail("e2e-profile-a@example.invalid")).toBe(true);
    expect(isE2eDisposableEmail("artist@gmail.com")).toBe(false);
  });
});
