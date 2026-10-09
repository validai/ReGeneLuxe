import { afterEach, describe, expect, it } from "vitest";
import {
  canonicalOAuthRedirect,
  canonicalRequestUrl,
  cookieHeaderHasPkce,
  getCanonicalOrigin,
  googleCallbackUrl,
  gmailCallbackUrl,
  youtubeCallbackUrl,
  isLoopbackHostname,
  publicAppOrigin,
  shouldRedirectLocalhostAlias,
  toCanonicalAuthRequest,
  toCanonicalPath,
  withCanonicalHostHeaders,
} from "./origin.js";

const original = {
  AUTH_URL: process.env.AUTH_URL,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  RL_PUBLIC_ORIGIN: process.env.RL_PUBLIC_ORIGIN,
  REGENELUXE_UI_PORT: process.env.REGENELUXE_UI_PORT,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  if (original.AUTH_URL == null) delete process.env.AUTH_URL;
  else process.env.AUTH_URL = original.AUTH_URL;
  if (original.NEXTAUTH_URL == null) delete process.env.NEXTAUTH_URL;
  else process.env.NEXTAUTH_URL = original.NEXTAUTH_URL;
  if (original.RL_PUBLIC_ORIGIN == null) delete process.env.RL_PUBLIC_ORIGIN;
  else process.env.RL_PUBLIC_ORIGIN = original.RL_PUBLIC_ORIGIN;
  if (original.REGENELUXE_UI_PORT == null) delete process.env.REGENELUXE_UI_PORT;
  else process.env.REGENELUXE_UI_PORT = original.REGENELUXE_UI_PORT;
  if (original.NODE_ENV == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = original.NODE_ENV;
});

describe("canonical auth origin", () => {
  it("keeps development on localhost and does not rewrite it to 127.0.0.1", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://localhost:5174";
    expect(getCanonicalOrigin()).toBe("http://localhost:5174");
    expect(new URL(getCanonicalOrigin()).hostname).toBe("localhost");
    expect(googleCallbackUrl()).toBe("http://localhost:5174/api/auth/callback/google");
    expect(gmailCallbackUrl()).toBe("http://localhost:5174/api/oauth/gmail/callback");
    expect(youtubeCallbackUrl()).toBe("http://localhost:5174/api/oauth/youtube/callback");
  });

  it("folds a numeric loopback AUTH_URL onto localhost in development", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    expect(getCanonicalOrigin()).toBe("http://localhost:5174");
    expect(googleCallbackUrl()).toBe("http://localhost:5174/api/auth/callback/google");
    expect(canonicalOAuthRedirect("http://127.0.0.1:5174/api/oauth/instagram/callback"))
      .toBe("http://localhost:5174/api/oauth/instagram/callback");
    expect(canonicalOAuthRedirect("http://localhost:5174/api/oauth/facebook/callback"))
      .toBe("http://localhost:5174/api/oauth/facebook/callback");
  });

  it("defaults an unset development origin to localhost", () => {
    process.env.NODE_ENV = "development";
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
    expect(getCanonicalOrigin()).toBe("http://localhost:5174");
  });

  it("keeps a production origin environment-driven", () => {
    process.env.NODE_ENV = "production";
    process.env.AUTH_URL = "https://app.example.com";
    expect(getCanonicalOrigin()).toBe("https://app.example.com");
    expect(googleCallbackUrl()).toBe("https://app.example.com/api/auth/callback/google");
    expect(canonicalOAuthRedirect("https://app.example.com/api/oauth/instagram/callback"))
      .toBe("https://app.example.com/api/oauth/instagram/callback");
    process.env.AUTH_URL = "http://127.0.0.1:5174";
    expect(getCanonicalOrigin()).toBe("http://127.0.0.1:5174");
  });

  it("keeps a localhost Auth.js callback on localhost and preserves PKCE", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://localhost:5174";
    const url = canonicalRequestUrl("http://127.0.0.1:5174/api/auth/callback/google?code=abc");
    expect(url.origin).toBe("http://localhost:5174");
    expect(url.pathname).toBe("/api/auth/callback/google");
    expect(url.searchParams.get("code")).toBe("abc");

    const headers = withCanonicalHostHeaders(new Headers({
      host: "127.0.0.1:5174",
      "x-forwarded-host": "127.0.0.1:5174",
    }));
    expect(headers.get("host")).toBe("localhost:5174");
    expect(headers.get("x-forwarded-host")).toBe("localhost:5174");
    expect(headers.get("x-forwarded-proto")).toBe("http");

    const pkce = "authjs.pkce.code_verifier=sealed-value";
    expect(cookieHeaderHasPkce(pkce)).toBe(true);
    const incoming = new Request("http://localhost:5174/api/auth/callback/google?code=abc", {
      headers: { cookie: pkce, host: "localhost:5174" },
    });
    const canonical = toCanonicalAuthRequest(incoming);
    expect(canonical.url).toBe("http://localhost:5174/api/auth/callback/google?code=abc");
    expect(canonical.headers.get("cookie")).toBe(pkce);
    expect(canonical.headers.get("host")).toBe("localhost:5174");
  });

  it("copies PKCE cookies from the Next.js cookie jar when the Request header is empty", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://localhost:5174";
    const incoming = new Request("http://localhost:5174/api/auth/callback/google?code=abc");
    const canonical = toCanonicalAuthRequest(incoming, "authjs.pkce.code_verifier=from-jar");
    expect(canonical.headers.get("cookie")).toBe("authjs.pkce.code_verifier=from-jar");
    expect(canonical.url).toBe("http://localhost:5174/api/auth/callback/google?code=abc");
  });

  it("returns provider callbacks to the same localhost origin and preserves the account path", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://localhost:5174";
    expect(toCanonicalPath("/accounts?connect=select&session=cxs_1")).toBe(
      "http://localhost:5174/accounts?connect=select&session=cxs_1",
    );
    expect(toCanonicalPath("http://127.0.0.1:5174/accounts?connect=select&session=cxs_1")).toBe(
      "http://localhost:5174/accounts?connect=select&session=cxs_1",
    );
    expect(toCanonicalPath("/setup/profile")).toBe("http://localhost:5174/setup/profile");
    expect(publicAppOrigin()).toBe("http://localhost:5174");
    expect(isLoopbackHostname("localhost")).toBe(true);
    expect(isLoopbackHostname("127.0.0.1")).toBe(true);
  });

  it("rejects protocol-relative and external redirect targets", () => {
    process.env.NODE_ENV = "test";
    process.env.AUTH_URL = "http://localhost:5174";
    expect(toCanonicalPath("https://evil.example/phish")).toBe("http://localhost:5174");
    expect(toCanonicalPath("//evil.example/phish")).toBe("http://localhost:5174");
    expect(toCanonicalPath("javascript:alert(1)")).toBe("http://localhost:5174");
  });

  it("does not redirect either loopback host", () => {
    expect(shouldRedirectLocalhostAlias("localhost:5174")).toBe(false);
    expect(shouldRedirectLocalhostAlias("127.0.0.1:5174")).toBe(false);
  });
});
