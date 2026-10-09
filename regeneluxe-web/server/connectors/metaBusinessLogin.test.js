import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-meta-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-meta-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { instagramConnector } = await import("./providers/meta.js");
const { META_BUSINESS_LOGIN_PERMISSIONS } = await import("./providers/metaGraph.js");
const { peekOAuthState } = await import("./oauth/state.js");
const { startAccountConnection } = await import("./accountConnection.js");

const ENV_KEYS = ["META_APP_ID", "META_APP_SECRET", "META_LOGIN_CONFIG_ID", "META_REDIRECT_URI"];
const previous = {};

describe("Facebook Login for Business", () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) previous[key] = process.env[key];
    process.env.META_APP_ID = "meta-app-id";
    process.env.META_APP_SECRET = "meta-app-secret";
    process.env.META_REDIRECT_URI = "http://localhost:5174/api/oauth/instagram/callback";
    delete process.env.META_LOGIN_CONFIG_ID;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (previous[key] == null) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("stays SETUP_REQUIRED when the login configuration id is missing", async () => {
    expect(instagramConnector.resolveReadiness()).toBe("SETUP_REQUIRED");
    const started = await instagramConnector.beginAuth({
      accountId: "cxs_missing",
      returnTo: "/accounts",
      operatorId: "opr_1",
      managedProfileId: "prf_dj",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
  });

  it("sends config_id and omits the legacy scope bundle", async () => {
    process.env.META_LOGIN_CONFIG_ID = "config-under-test";
    const started = await instagramConnector.beginAuth({
      accountId: "cxs_ready",
      returnTo: "/accounts?connect=select&session=cxs_ready",
      operatorId: "opr_1",
      managedProfileId: "prf_dj",
    });
    expect(started.ok).toBe(true);
    const url = new URL(started.authUrl);
    expect([...url.searchParams.keys()].sort()).toEqual(["client_id", "config_id", "redirect_uri", "response_type", "state"]);
    expect(url.searchParams.get("client_id")).toBe("meta-app-id");
    expect(url.searchParams.get("config_id")).toBe("config-under-test");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5174/api/oauth/instagram/callback");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.has("scope")).toBe(false);
    expect(started.authUrl).not.toMatch(/pages_manage_posts|pages_messaging|ads_|instagram_manage_comments|instagram_manage_insights|meta-app-secret/i);
    expect(META_BUSINESS_LOGIN_PERMISSIONS).toEqual([
      "business_management",
      "instagram_basic",
      "instagram_content_publish",
      "pages_read_engagement",
      "pages_show_list",
    ]);

    const peeked = peekOAuthState(url.searchParams.get("state"));
    expect(peeked.ok).toBe(true);
    expect(peeked.provider).toBe("instagram");
    expect(peeked.operatorId).toBe("opr_1");
    expect(peeked.managedProfileId).toBe("prf_dj");
    expect(peeked.returnTo).toBe("/accounts?connect=select&session=cxs_ready");
    expect(url.searchParams.get("state").length).toBeGreaterThan(16);
    expect(JSON.stringify(peeked)).not.toMatch(/config-under-test|meta-app-secret|config_id/);
  });

  it("keeps the configuration id out of the public connection session", async () => {
    process.env.META_LOGIN_CONFIG_ID = "config-under-test";
    const started = await startAccountConnection({
      provider: "instagram",
      operatorId: "opr_1",
      workspaceId: "prf_dj",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(true);
    expect(started.session.workspaceId).toBe("prf_dj");
    expect(started.session.workspaceName).toBe("DJ Coast");
    expect(JSON.stringify(started.session)).not.toMatch(/config-under-test|meta-app-secret|config_id|access_token/);
    const url = new URL(started.authUrl);
    expect(url.searchParams.get("config_id")).toBe("config-under-test");
    expect(url.searchParams.has("scope")).toBe(false);
  });
});
