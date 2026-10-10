import { describe, expect, it } from "vitest";
import {
  CANONICAL_APP_ORIGIN,
  THREADS_CALLBACK_URL,
  handleThreadsHttpsRequest,
  threadsRedirectUri,
} from "./threadsHttpsBridge.js";

const HOST = "threads.regeneluxe.test:5175";

describe("threads local https bridge", () => {
  it("accepts only the exact local https callback as THREADS_REDIRECT_URI", () => {
    expect(threadsRedirectUri(THREADS_CALLBACK_URL)).toBe(THREADS_CALLBACK_URL);
    expect(threadsRedirectUri("http://127.0.0.1:5174/api/oauth/threads/callback")).toBe("");
    expect(threadsRedirectUri("http://localhost:5174/api/oauth/threads/callback")).toBe("");
    expect(threadsRedirectUri("https://example.com/api/oauth/threads/callback")).toBe("");
    expect(threadsRedirectUri(`${THREADS_CALLBACK_URL}?next=https://evil.example`)).toBe("");
  });

  it("redirects the callback query to the canonical app and drops every other parameter", () => {
    const result = handleThreadsHttpsRequest({
      method: "GET",
      host: HOST,
      url: "/api/oauth/threads/callback?code=abc%2F123&state=cxs_deadbeef&error_description=hello+there&next=https%3A%2F%2Fevil.example",
    });
    expect(result.status).toBe(302);
    const location = new URL(result.headers.Location);
    expect(location.origin).toBe(CANONICAL_APP_ORIGIN);
    expect(location.pathname).toBe("/api/oauth/threads/callback");
    expect(location.searchParams.get("code")).toBe("abc/123");
    expect(location.searchParams.get("state")).toBe("cxs_deadbeef");
    expect(location.searchParams.get("error_description")).toBe("hello there");
    expect(location.searchParams.get("next")).toBeNull();
    expect(JSON.stringify({ status: result.status, body: result.body })).not.toContain("abc/123");
  });

  it("refuses every path that is not a Threads callback, deauthorize, or data-deletion route", () => {
    expect(handleThreadsHttpsRequest({ method: "GET", host: HOST, url: "/" }).status).toBe(404);
    expect(handleThreadsHttpsRequest({ method: "GET", host: HOST, url: "/api/oauth/instagram/callback?code=secret" }).status).toBe(404);
    expect(handleThreadsHttpsRequest({ method: "GET", host: HOST, url: "/api/health" }).status).toBe(404);
    expect(handleThreadsHttpsRequest({ method: "GET", host: "localhost:5175", url: "/api/oauth/threads/callback?code=abc" }).status).toBe(404);
    expect(handleThreadsHttpsRequest({ method: "POST", host: HOST, url: "/api/oauth/threads/callback?code=abc" }).status).toBe(405);
  });

  it("acknowledges deauthorize and data deletion without echoing a request body", () => {
    const deauthorize = handleThreadsHttpsRequest({ method: "POST", host: HOST, url: "/api/oauth/threads/deauthorize" });
    expect(deauthorize.status).toBe(200);
    expect(deauthorize.body).toBe("ok");
    const deletion = handleThreadsHttpsRequest({ method: "POST", host: HOST, url: "/api/oauth/threads/data-deletion" });
    const receipt = JSON.parse(deletion.body);
    expect(receipt.url).toMatch(/^https:\/\/threads\.regeneluxe\.test:5175\/api\/oauth\/threads\/data-deletion\?id=[a-f0-9]{18}$/);
    expect(receipt.confirmation_code).toHaveLength(18);
    expect(deletion.body).not.toContain("signed_request");
  });
});
