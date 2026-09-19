import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalRequestUrl,
  getCanonicalOrigin,
  googleCallbackUrl,
  gmailCallbackUrl,
  isLoopbackHostname,
  shouldRedirectLocalhostAlias,
  toCanonicalPath,
  withCanonicalHostHeaders,
} from "./origin.js";

const original = {
  AUTH_URL: process.env.AUTH_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  REGENELUXE_UI_PORT: process.env.REGENELUXE_UI_PORT,
};

afterEach(() => {
  if (original.AUTH_URL == null) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = original.AUTH_URL;
  if (original.NEXTAUTH_URL == null) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = original.NEXTAUTH_URL;
  if (original.REGENELUXE_UI_PORT == null) delete process.env.REGENELUXE_UI_PORT;
  else process.env.REGENELUXE_UI_PORT = original.REGENELUXE_UI_PORT;
});

describe("canonical auth origin", () => {
  it("prefers 127.0.0.1 over localhost", () => {
    process.env.AUTH_URL = "http://localhost:5174";
    expect(getCanonicalOrigin()).toBe("http://127.0.0.1:5174");
    expect(googleCallbackUrl()).toBe("http://127.0.0.1:5174/api/auth/callback/google");
    expect(gmailCallbackUrl()).toBe("http://127.0.0.1:5174/api/oauth/gmail/callback");
  });

  it("keeps an explicit 127.0.0.1 AUTH_URL", () => {
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    expect(getCanonicalOrigin()).toBe("http://127.0.0.1:5174");
  });

  it("rewrites a localhost callback request onto 127.0.0.1", () => {
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    const url = canonicalRequestUrl("http://localhost:5174/api/auth/callback/google?code=abc");
    expect(url.origin).toBe("http://127.0.0.1:5174");
    expect(url.pathname).toBe("/api/auth/callback/google");
    expect(url.searchParams.get("code")).toBe("abc");
  });

  it("overwrites Host / x-forwarded-host so Next.js cannot restore localhost", () => {
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    const headers = withCanonicalHostHeaders(new Headers({
      host: "localhost:5174",
      "x-forwarded-host": "localhost:5174",
    }));
    expect(headers.get("host")).toBe("127.0.0.1:5174");
    expect(headers.get("x-forwarded-host")).toBe("127.0.0.1:5174");
    expect(headers.get("x-forwarded-proto")).toBe("http");
  });

  it("maps relative and localhost redirect targets onto the canonical origin", () => {
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    expect(toCanonicalPath("/setup/profile")).toBe("http://127.0.0.1:5174/setup/profile");
    expect(toCanonicalPath("/signin?signedOut=1")).toBe("http://127.0.0.1:5174/signin?signedOut=1");
    expect(toCanonicalPath("http://localhost:5174/signin?signedOut=1")).toBe("http://127.0.0.1:5174/signin?signedOut=1");
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
  });

  it("redirects Host localhost but not 127.0.0.1", () => {
    expect(shouldRedirectLocalhostAlias("localhost:5174")).toBe(true);
    expect(shouldRedirectLocalhostAlias("127.0.0.1:5174")).toBe(false);
  });
});
