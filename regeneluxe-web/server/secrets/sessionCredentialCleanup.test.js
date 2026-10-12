import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-vault-clean-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-vault-clean-key-")), "key");
process.env.RL_DB_MODE = "memory";
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, upsert, COLLECTIONS } = await import("../db/index.js");
const { getAccountTokens, setAccountTokens } = await import("./providers.js");
const { createConnectionSession } = await import("../connectors/connectionSession.js");
const { readSecrets, writeSecrets } = await import("../secrets.js");
const { cleanupOrphanSessionCredentials } = await import("./sessionCredentialCleanup.js");

describe("connection session credential cleanup", () => {
  beforeEach(async () => {
    await resetDbForTests();
    await initDb();
    writeSecrets({ ai: { provider: "none", apiKey: "" }, providers: {}, connectionSessions: {} });
  });

  it("removes orphan and expired session credentials and keeps live, gmail, active, and ambiguous keys", async () => {
    await upsert(COLLECTIONS.accounts, {
      id: "acc_live",
      platform: "Instagram",
      connectionState: "CONNECTED",
      providerAccountId: "ig_live",
      managedProfileId: "prf_1",
    });
    await upsert(COLLECTIONS.accounts, {
      id: "acc_test",
      platform: "Instagram",
      connectionState: "TOMBSTONED",
      providerAccountId: "ig_test",
      managedProfileId: "prf_1",
    });
    await upsert(COLLECTIONS.accounts, {
      id: "cxs_ambiguous",
      platform: "Facebook",
      connectionState: "CONNECTED",
      providerAccountId: "page_ambiguous",
      managedProfileId: "prf_1",
    });
    setAccountTokens("instagram", "acc_live", { accessToken: "live-token", scopes: ["instagram_content_publish"] });
    setAccountTokens("instagram", "acc_test", { accessToken: "tombstone-token", scopes: ["instagram_basic"] });
    setAccountTokens("gmail", "prf_gmail", { accessToken: "gmail-token", scopes: ["https://www.googleapis.com/auth/gmail.readonly"] });
    setAccountTokens("instagram", "cxs_ambiguous", { accessToken: "ambiguous-token" });
    setAccountTokens("instagram", "cxs_orphan", { accessToken: "orphan-token" });

    const active = createConnectionSession({ provider: "instagram", operatorId: "opr_1", workspaceId: "prf_1" });
    setAccountTokens("instagram", active.id, { accessToken: "active-session-token" });

    const expired = createConnectionSession({ provider: "instagram", operatorId: "opr_1", workspaceId: "prf_1" });
    setAccountTokens("instagram", expired.id, { accessToken: "expired-session-token" });
    const secrets = readSecrets();
    secrets.connectionSessions[expired.id].expiresAt = "2020-01-01T00:00:00.000Z";
    secrets.connectionSessions[expired.id].status = "cancelled";
    writeSecrets(secrets);

    const first = await cleanupOrphanSessionCredentials();
    const removedKeys = first.removed.map((row) => row.key).sort();
    expect(removedKeys).toEqual([
      `instagram::${expired.id}`,
      "instagram::cxs_orphan",
    ].sort());
    expect(getAccountTokens("instagram", "acc_live")?.accessToken).toBe("live-token");
    expect(getAccountTokens("instagram", "acc_test")?.accessToken).toBe("tombstone-token");
    expect(getAccountTokens("gmail", "prf_gmail")?.accessToken).toBe("gmail-token");
    expect(getAccountTokens("instagram", "cxs_ambiguous")?.accessToken).toBe("ambiguous-token");
    expect(getAccountTokens("instagram", active.id)?.accessToken).toBe("active-session-token");
    expect(getAccountTokens("instagram", "cxs_orphan")).toBeNull();
    expect(getAccountTokens("instagram", expired.id)).toBeNull();

    const second = await cleanupOrphanSessionCredentials();
    expect(second.removed).toEqual([]);
  });
});
