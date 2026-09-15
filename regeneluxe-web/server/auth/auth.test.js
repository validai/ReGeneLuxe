import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowedEmails } from "./allowlist.js";
import { isPublicPath, shouldRedirectToSignIn } from "./publicPaths.js";
import { authErrorMessage } from "./errors.js";

describe("pilot allowlist", () => {
  it("parses comma-separated emails", () => {
    expect(parseAllowedEmails("validsstudio@gmail.com, other@x.com")).toEqual([
      "validsstudio@gmail.com",
      "other@x.com",
    ]);
  });

  it("approves the intended operator email", () => {
    const allowed = ["validsstudio@gmail.com"];
    expect(isEmailAllowed("validsstudio@gmail.com", allowed)).toBe(true);
    expect(isEmailAllowed("ValidsStudio@gmail.com", allowed)).toBe(true);
  });

  it("rejects unauthorized Google users", () => {
    const allowed = ["validsstudio@gmail.com"];
    expect(isEmailAllowed("stranger@gmail.com", allowed)).toBe(false);
    expect(isEmailAllowed("", allowed)).toBe(false);
  });

  it("fails closed when allowlist is empty", () => {
    expect(isEmailAllowed("validsstudio@gmail.com", [])).toBe(false);
  });
});

describe("route protection", () => {
  it("redirects unauthenticated workspace requests to sign-in", () => {
    expect(shouldRedirectToSignIn("/", false)).toBe(true);
    expect(shouldRedirectToSignIn("/settings", false)).toBe(true);
    expect(shouldRedirectToSignIn("/signin", false)).toBe(false);
    expect(shouldRedirectToSignIn("/api/auth/callback/google", false)).toBe(false);
    expect(shouldRedirectToSignIn("/api/health", false)).toBe(false);
    expect(shouldRedirectToSignIn("/api/oauth/youtube/callback", false)).toBe(false);
  });

  it("does not create a public-path loop for signed-in operators", () => {
    expect(shouldRedirectToSignIn("/", true)).toBe(false);
    expect(isPublicPath("/signin")).toBe(true);
    expect(isPublicPath("/access-not-authorized")).toBe(true);
  });

  it("does not redirect public auth callback paths", () => {
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
    expect(isPublicPath("/api/auth/session")).toBe(true);
    expect(isPublicPath("/setup/profile")).toBe(false);
  });
});

describe("auth error copy", () => {
  it("uses operator-friendly messages", () => {
    expect(authErrorMessage("AccessDenied")).toMatch(/cancelled or denied/i);
    expect(authErrorMessage("OAuthCallback")).toMatch(/invalid callback/i);
    expect(authErrorMessage("Configuration")).toMatch(/127\.0\.0\.1:5174/);
    expect(authErrorMessage("database")).toMatch(/local database/i);
    expect(authErrorMessage("expired")).toMatch(/session expired/i);
    expect(authErrorMessage("sync")).toMatch(/cloud sync/i);
  });
});
