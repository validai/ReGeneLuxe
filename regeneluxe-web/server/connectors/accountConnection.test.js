import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-conn-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;
delete process.env.META_APP_ID;
delete process.env.META_APP_SECRET;
delete process.env.META_LOGIN_CONFIG_ID;
delete process.env.THREADS_APP_ID;
delete process.env.THREADS_APP_SECRET;

const { initDb, list, resetDbForTests, COLLECTIONS } = await import("../db/index.js");
const { setAccountTokens, getAccountTokens } = await import("../secrets/providers.js");
const {
  cancelAccountConnection,
  confirmAccountConnection,
  readPublicConnectionSession,
  startAccountConnection,
} = await import("./accountConnection.js");
const { createConnectionSession, updateConnectionSession } = await import("./connectionSession.js");

describe("account connection orchestration", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
  });

  it("does not create an account row when provider setup is required", async () => {
    const before = await list(COLLECTIONS.accounts);
    const started = await startAccountConnection({
      provider: "instagram",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    expect(started.ok).toBe(false);
    expect(started.readiness).toBe("SETUP_REQUIRED");
    expect(started.authUrl).toBeUndefined();
    expect(await list(COLLECTIONS.accounts)).toEqual(before);
  });

  it("creates a connected account only after destination confirmation", async () => {
    const session = createConnectionSession({
      provider: "instagram",
      operatorId: "opr_1",
      workspaceId: "prf_1",
      workspaceName: "DJ Coast",
    });
    updateConnectionSession(session.id, {
      status: "selecting",
      destinations: [{
        id: "instagram:ig_1",
        provider: "instagram",
        platform: "Instagram",
        name: "djcoast",
        handle: "@djcoast",
        type: "Instagram professional account",
        externalId: "ig_1",
        relationship: "Linked Page: DJ Coast",
        pageId: "page_1",
        pageName: "DJ Coast",
        profileUrl: "https://www.instagram.com/djcoast/",
      }],
    });
    setAccountTokens("instagram", session.id, {
      accessToken: "meta-user-token",
      providerAccountId: null,
      pages: [{ id: "page_1", name: "DJ Coast", access_token: "page-token" }],
    });
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
    const pending = readPublicConnectionSession(session.id, { operatorId: "opr_1", workspaceId: "prf_1" });
    expect(pending.ok).toBe(true);
    expect(pending.session.workspaceId).toBe("prf_1");
    expect(Date.parse(pending.session.expiresAt)).toBeGreaterThan(Date.parse(pending.session.startedAt));
    expect(JSON.stringify(pending.session)).not.toMatch(/accessToken|refreshToken|pageAccessToken|clientSecret|meta-user-token|page-token|authorization/i);

    const cancelled = createConnectionSession({
      provider: "threads",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    await cancelAccountConnection({ sessionId: cancelled.id, operatorId: "opr_1", workspaceId: "prf_1" });
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);

    const confirmed = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["instagram:ig_1"],
    });
    expect(confirmed.ok).toBe(true);
    expect(confirmed.created[0].connectionState).toBe("CONNECTED");
    expect(confirmed.created[0].providerAccountId).toBe("ig_1");
    expect(confirmed.created[0].handle).toBe("@djcoast");
    expect(JSON.stringify(confirmed.created[0])).not.toMatch(/meta-user-token|page-token/);
    const stored = getAccountTokens("instagram", confirmed.created[0].id);
    expect(stored.accessToken).toBe("meta-user-token");
    expect(getAccountTokens("instagram", session.id)).toBeNull();
    const visible = readPublicConnectionSession(session.id, { operatorId: "opr_1", workspaceId: "prf_1" });
    expect(visible.ok).toBe(false);

    const renamed = { ...confirmed.created[0], handle: "@renamed" };
    const again = createConnectionSession({
      provider: "instagram",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    updateConnectionSession(again.id, {
      destinations: [{
        id: "instagram:ig_1",
        provider: "instagram",
        platform: "Instagram",
        name: "renamed",
        handle: "@renamed",
        type: "Instagram professional account",
        externalId: "ig_1",
      }],
    });
    const duplicate = await confirmAccountConnection({
      sessionId: again.id,
      operatorId: "opr_1",
      workspaceId: "prf_1",
      selectedIds: ["instagram:ig_1"],
    });
    expect(duplicate.ok).toBe(false);
    expect(duplicate.failure).toBe("duplicate");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(1);
    expect(renamed.providerAccountId).toBe("ig_1");
  });

  it("refuses a callback session from another workspace", async () => {
    const session = createConnectionSession({
      provider: "youtube",
      operatorId: "opr_1",
      workspaceId: "prf_1",
    });
    const result = await confirmAccountConnection({
      sessionId: session.id,
      operatorId: "opr_other",
      workspaceId: "prf_other",
      selectedIds: [],
    });
    expect(result.failure).toBe("workspace");
    expect(await list(COLLECTIONS.accounts)).toHaveLength(0);
  });
});
