import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-fb-scope-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-fb-scope-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, list, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens, setAccountTokens } = await import("../secrets/providers.js");
const { facebookConnector, instagramConnector } = await import("./providers/meta.js");
const { confirmAccountConnection } = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");
const { listProviderDefinitions } = await import("./registry.js");

const GRANTED = [
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
  "pages_read_engagement",
  "pages_show_list",
];

describe("facebook page posting scope", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
    process.env.META_LOGIN_CONFIG_ID = "config-under-test";
    process.env.META_REDIRECT_URI = "http://localhost:5174/api/oauth/facebook/callback";
    vi.stubGlobal("fetch", vi.fn());
  });

  it("stores the granted Meta permissions and does not invent pages_manage_posts", async () => {
    fetch.mockImplementation(async (url) => {
      const href = String(url);
      if (href.includes("/me/permissions")) {
        return { ok: true, json: async () => ({ data: GRANTED.map((permission) => ({ permission, status: "granted" })) }) };
      }
      if (href.includes("/me/accounts")) {
        return {
          ok: true,
          json: async () => ({
            data: [{ id: "page_1", name: "DJ Coast", tasks: ["CREATE_CONTENT"], access_token: "page-token", instagram_business_account: { id: "ig_1", username: "_djcoast" } }],
          }),
        };
      }
      return { ok: true, json: async () => ({ access_token: "meta-user-token", expires_in: 3600 }) };
    });
    const result = await facebookConnector.completeAuth({ code: "auth-code", stateMeta: { accountId: "cxs_fb" } });
    expect(result.ok).toBe(true);
    const stored = getAccountTokens("facebook", "cxs_fb");
    expect(stored.scopes).toEqual(GRANTED);
    expect(stored.scopes).not.toContain("pages_manage_posts");
    expect(JSON.stringify(result)).not.toMatch(/meta-user-token|page-token|meta-app-secret/);
    const started = await facebookConnector.beginAuth({
      accountId: "cxs_fb",
      returnTo: "/accounts",
      operatorId: "opr_1",
      managedProfileId: "prf_1",
    });
    expect(new URL(started.authUrl).searchParams.has("scope")).toBe(false);
    expect(started.authUrl).not.toMatch(/pages_manage_posts/);
  });

  it("does not call the Page feed without pages_manage_posts", async () => {
    setAccountTokens("facebook", "acc_fb", {
      accessToken: "meta-user-token",
      scopes: GRANTED,
      pages: [{ id: "page_1", access_token: "page-token" }],
    });
    const blocked = await facebookConnector.publishContent(
      { id: "acc_fb", pageId: "page_1" },
      { text: "Hello" },
    );
    expect(blocked.code).toBe("PERMISSION_MISSING");
    expect(fetch).not.toHaveBeenCalled();

    setAccountTokens("facebook", "acc_fb", {
      accessToken: "meta-user-token",
      scopes: [...GRANTED, "pages_manage_posts"],
      pages: [{ id: "page_1", access_token: "page-token" }],
    });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "page_1_post_1" }) });
    const ready = await facebookConnector.publishContent(
      { id: "acc_fb", pageId: "page_1" },
      { text: "Hello" },
    );
    expect(ready.ok).toBe(true);
    expect(String(fetch.mock.calls[0][0])).toContain("/page_1/feed");
    expect(listProviderDefinitions().find((item) => item.provider === "facebook")?.pagePosting).toBe("GRANTED");
  });

  it("merges a Facebook reauth into the existing Page and leaves Instagram untouched", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_ig",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_1",
      externalDestinationId: "ig_1",
      managedProfileId: "prf_1",
      handle: "@_djcoast",
    });
    await upsert(COLLECTIONS.accounts, {
      id: "acc_fb",
      platform: "Facebook",
      connectionState: "CONNECTED",
      providerAccountId: "page_1",
      externalDestinationId: "page_1",
      managedProfileId: "prf_1",
      displayName: "DJ Coast",
    });
    setAccountTokens("instagram", "acc_ig", {
      accessToken: "instagram-token",
      scopes: GRANTED,
      pages: [{ id: "page_1", access_token: "ig-page-token", instagram_business_account: { id: "ig_1" } }],
    });
    setAccountTokens("facebook", "acc_fb", {
      accessToken: "old-facebook-token",
      scopes: GRANTED,
      pages: [{ id: "page_1", access_token: "old-page-token" }],
    });
    const session = createConnectionSession({ provider: "facebook", operatorId: "opr_1", workspaceId: "prf_1" });
    setAccountTokens("facebook", session.id, {
      accessToken: "new-facebook-token",
      scopes: [...GRANTED, "pages_manage_posts"],
      pages: [{ id: "page_1", access_token: "new-page-token" }],
    });
    updateConnectionSession(session.id, {
      destinations: [
        {
          id: "instagram:ig_1",
          provider: "instagram",
          platform: "Instagram",
          name: "_djcoast",
          handle: "@_djcoast",
          externalId: "ig_1",
          pageId: "page_1",
        },
        {
          id: "facebook:page_1",
          provider: "facebook",
          platform: "Facebook",
          name: "DJ Coast",
          externalId: "page_1",
          pageId: "page_1",
        },
      ],
    });
    const confirmed = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["instagram:ig_1", "facebook:page_1"],
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.created).toEqual([]);
    expect(confirmed.linked.map((account) => account.id)).toEqual(["acc_fb"]);
    const accounts = await list(COLLECTIONS.accounts);
    expect(accounts.filter((account) => account.platform === "Instagram")).toHaveLength(1);
    expect(accounts.filter((account) => account.platform === "Facebook")).toHaveLength(1);
    expect(getAccountTokens("instagram", "acc_ig")?.accessToken).toBe("instagram-token");
    expect(getAccountTokens("instagram", "acc_ig")?.scopes).toEqual(GRANTED);
    expect(getAccountTokens("facebook", "acc_fb")?.accessToken).toBe("new-facebook-token");
    expect(getAccountTokens("facebook", "acc_fb")?.scopes).toContain("pages_manage_posts");
    expect(getAccountTokens("facebook", "acc_fb")?.scopes).toEqual(expect.arrayContaining(GRANTED));
    expect(instagramConnector).toBeTruthy();
  });
});
