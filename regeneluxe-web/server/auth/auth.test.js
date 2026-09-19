import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowedEmails } from "./allowlist.js";
import { isPublicPath, shouldRedirectToSignIn } from "./publicPaths.js";
import { authErrorMessage } from "./errors.js";
import { isSignedOutParam, SIGNED_OUT_HREF } from "./signedOut.js";
import { OPERATOR_GOOGLE_SCOPES, GMAIL_CONNECTION_SCOPES, GMAIL_READONLY_SCOPE } from "./googleScopes.js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

describe("pilot allowlist", () => {
  it("parses comma-separated emails", () => {
    expect(parseAllowedEmails("validsstudio@gmail.com, other@x.com")).toEqual([
      "validsstudio@gmail.com",
      "other@x.com",
    ]);
  });

  it("approves the intended operator email", () => {
    const allowed = ["djcoast239@gmail.com"];
    expect(isEmailAllowed("djcoast239@gmail.com", allowed)).toBe(true);
    expect(isEmailAllowed("DJCoast239@gmail.com", allowed)).toBe(true);
  });

  it("rejects unauthorized Google users", () => {
    const allowed = ["djcoast239@gmail.com"];
    expect(isEmailAllowed("stranger@gmail.com", allowed)).toBe(false);
    expect(isEmailAllowed("validsstudio@gmail.com", allowed)).toBe(false);
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
    expect(shouldRedirectToSignIn("/api/oauth/gmail/callback", false)).toBe(false);
    expect(shouldRedirectToSignIn("/api/oauth/gmail/start", false)).toBe(false);
    expect(isPublicPath("/api/oauth/gmail/callback")).toBe(true);
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
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
    expect(authErrorMessage("identity")).toMatch(/already linked/i);
    expect(authErrorMessage("expired")).toMatch(/session expired/i);
    expect(authErrorMessage("sync")).toMatch(/cloud sync/i);
  });

  it("treats signed-out as confirmation state, not an auth error", () => {
    expect(isSignedOutParam("1")).toBe(true);
    expect(isSignedOutParam("true")).toBe(true);
    expect(isSignedOutParam(["yes"])).toBe(true);
    expect(isSignedOutParam("")).toBe(false);
    expect(isSignedOutParam("0")).toBe(false);
    expect(SIGNED_OUT_HREF).toBe("/signin?signedOut=1");
    const actionsPath = join(dirname(fileURLToPath(import.meta.url)), "../../app/actions/auth.ts");
    expect(readFileSync(actionsPath, "utf8")).toContain("SIGNED_OUT_HREF");
    expect(authErrorMessage("signedOut")).not.toMatch(/successfully signed out/i);
  });
});

describe("operator Google scopes stay separate from Gmail", () => {
  it("does not request gmail.readonly at Auth.js sign-in", () => {
    expect(OPERATOR_GOOGLE_SCOPES.split(/\s+/)).toEqual(["openid", "profile", "email"]);
    expect(OPERATOR_GOOGLE_SCOPES).not.toMatch(/gmail/i);
    expect(GMAIL_CONNECTION_SCOPES).toContain(GMAIL_READONLY_SCOPE);
    expect(GMAIL_CONNECTION_SCOPES).toContain("openid");
    const configPath = join(dirname(fileURLToPath(import.meta.url)), "../../auth.config.ts");
    const config = readFileSync(configPath, "utf8");
    expect(config).toContain("OPERATOR_GOOGLE_SCOPES");
    expect(config).not.toContain("gmail.readonly");
    expect(config).not.toContain("/api/oauth/gmail/callback");
  });
});
