import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { isEmailAllowed } from "./allowlist.js";
import { isPublicPath } from "./publicPaths.js";
import { isAllowedRequestOrigin, isSafeLocalPath, safeReturnTo } from "./origin.js";
import { applyRemoteRecord, isAllowedMetaKey, lockIdentityFields, stripForbiddenWriteFields } from "./identityLock.js";
import { recordBelongsToWorkspace, listWorkspaceCollection, CLIENT_HIDDEN_COLLECTIONS } from "./tenantScope.js";
import { encryptSecret, decryptSecret } from "../secrets/crypto.js";
import { createOAuthState, consumeOAuthState } from "../connectors/oauth/state.js";
import { sanitizeAiContext } from "../../src/data/ai/validator.js";
import { isSafeHttpUrl, isSafeExternalFetchUrl } from "../../src/data/httpUrl.js";
import { COLLECTIONS } from "../db/collections.js";

process.env.RL_DB_MODE = "memory";
process.env.APP_ALLOWED_GOOGLE_EMAILS = "a@example.com,b@example.com";
process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-sec-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-key-")), "key");
delete process.env.TURSO_DATABASE_URL;
delete process.env.TURSO_AUTH_TOKEN;

const { initDb, resetDbForTests, closeDb, upsert, list } = await import("../db/index.js");
const { upsertOperatorFromGoogle } = await import("../db/operatorRepository.js");
const { createManagedProfile } = await import("../db/managedProfileRepository.js");
const { saveProfileImageBuffer, readLocalMedia, detectImageMime } = await import("../media/store.js");

function pngBuffer(bytes = 300) {
  const buffer = Buffer.alloc(bytes, 1);
  buffer[0] = 0x89; buffer[1] = 0x50; buffer[2] = 0x4e; buffer[3] = 0x47;
  buffer[4] = 0x0d; buffer[5] = 0x0a; buffer[6] = 0x1a; buffer[7] = 0x0a;
  return buffer;
}

describe("application security boundaries", () => {
  beforeEach(async () => {
    process.env.RL_DB_MODE = "memory";
    await resetDbForTests();
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it("denies unauthenticated callers by requiring operatorId on protected paths", () => {
    expect(isPublicPath("/api/data/collection")).toBe(false);
    expect(isPublicPath("/api/data/snapshot")).toBe(false);
    expect(isPublicPath("/api/backup")).toBe(false);
    expect(isPublicPath("/api/sync")).toBe(false);
    expect(isPublicPath("/api/jobs/tick")).toBe(false);
    expect(isPublicPath("/api/secrets")).toBe(false);
    expect(isPublicPath("/api/publish")).toBe(false);
    expect(isPublicPath("/api/oauth/gmail/start")).toBe(false);
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/api/auth/callback/google")).toBe(true);
  });

  it("rejects Account A reading Account B workspace records", async () => {
    const a = await upsertOperatorFromGoogle({ googleSub: "sub-a", email: "a@example.com" });
    const b = await upsertOperatorFromGoogle({ googleSub: "sub-b", email: "b@example.com" });
    const workspaceA = await createManagedProfile(a.id, { displayName: "A" });
    const workspaceB = await createManagedProfile(b.id, { displayName: "B" });
    await upsert(COLLECTIONS.campaigns, { id: "camp_a", name: "A campaign", managedProfileId: workspaceA.id });
    await upsert(COLLECTIONS.campaigns, { id: "camp_b", name: "B campaign", managedProfileId: workspaceB.id });
    const authzA = { operator: a, workspace: workspaceA, activeProfile: workspaceA };
    const rows = await listWorkspaceCollection(COLLECTIONS.campaigns, authzA);
    expect(rows.map((row) => row.id)).toEqual(["camp_a"]);
    const bCampaign = (await list(COLLECTIONS.campaigns)).find((row) => row.id === "camp_b");
    expect(recordBelongsToWorkspace(bCampaign, authzA)).toBe(false);
    expect(CLIENT_HIDDEN_COLLECTIONS.has(COLLECTIONS.gmail_messages)).toBe(true);
  });

  it("rejects mass assignment of identity and token fields", () => {
    const cleaned = stripForbiddenWriteFields({
      name: "DJ Coast",
      googleSub: "attacker",
      ownerOperatorId: "opr_other",
      accessToken: "stolen",
      role: "admin",
    });
    expect(cleaned.name).toBe("DJ Coast");
    expect(cleaned.googleSub).toBeUndefined();
    expect(cleaned.ownerOperatorId).toBeUndefined();
    expect(cleaned.accessToken).toBeUndefined();
    expect(cleaned.role).toBeUndefined();
    const locked = lockIdentityFields({ googleSub: "x", name: "ok" }, { googleSub: "coast-sub", name: "DJ Coast" });
    expect(locked.googleSub).toBe("coast-sub");
  });

  it("replays OAuth state only once and sanitizes returnTo", () => {
    const state = createOAuthState({
      provider: "x",
      accountId: "acc_1",
      returnTo: "https://evil.example/phish",
      operatorId: "opr_1",
    });
    const first = consumeOAuthState(state);
    expect(first.ok).toBe(true);
    expect(first.returnTo).toBe("/accounts");
    const second = consumeOAuthState(state);
    expect(second.ok).toBe(false);
    expect(consumeOAuthState("tampered")).toBeTruthy();
    expect(consumeOAuthState("tampered").ok).toBe(false);
  });

  it("rejects open redirects and dangerous URL schemes", () => {
    expect(isSafeLocalPath("//evil.example")).toBe(false);
    expect(safeReturnTo("https://evil.example", "/settings")).toBe("/settings");
    expect(safeReturnTo("/settings", "/")).toBe("/settings");
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeHttpUrl("data:text/html,hi")).toBe(false);
    expect(isSafeHttpUrl("https://example.com")).toBe(true);
    expect(isSafeExternalFetchUrl("http://127.0.0.1/secret")).toBe(false);
    expect(isSafeExternalFetchUrl("http://169.254.169.254/latest/meta-data")).toBe(false);
  });

  it("does not let a remote record change Google identity ownership", () => {
    const local = { id: "opr_1", googleSub: "coast-sub", email: "a@example.com", ownerOperatorId: "opr_1" };
    const remote = { id: "opr_1", googleSub: "attacker", email: "b@example.com", ownerOperatorId: "opr_evil" };
    const merged = applyRemoteRecord("operators", local, remote);
    expect(merged.googleSub).toBe("coast-sub");
    expect(merged.email).toBe("a@example.com");
  });

  it("rejects SQL-hostile collection names through the allowlist", () => {
    expect(Object.values(COLLECTIONS).includes("campaigns;drop table entities")).toBe(false);
    expect(isAllowedMetaKey("TURSO_AUTH_TOKEN")).toBe(false);
    expect(isAllowedMetaKey("active_campaign_id")).toBe(true);
  });

  it("confines media reads and rejects HTML as a fake image", async () => {
    const dir = mkdtempSync(join(tmpdir(), "rl-media-sec-"));
    process.env.RL_MEDIA_DIR = dir;
    mkdirSync(dir, { recursive: true });
    await expect(saveProfileImageBuffer({
      buffer: Buffer.from("<script>alert(1)</script>"),
      mimeType: "image/png",
      originalName: "x.png",
    })).rejects.toThrow(/png, jpg, or webp/i);
    const saved = await saveProfileImageBuffer({
      buffer: pngBuffer(),
      mimeType: "image/png",
      originalName: "ok.png",
      managedProfileId: "prf_a",
    });
    writeFileSync(join(dir, `${saved.id}.json`), JSON.stringify({
      ...saved,
      storedName: "../../.env.local",
    }));
    expect(readLocalMedia(`${saved.id}/../.env.local`)).toBeNull();
    expect(readLocalMedia(saved.id)).toBeNull();
    expect(readLocalMedia(saved.id, { workspaceId: "prf_b" })).toBeNull();
    expect(detectImageMime(Buffer.from("<svg></svg>"))).toBeNull();
    delete process.env.RL_MEDIA_DIR;
  });

  it("keeps tokens and secrets out of Campaign Brain context", () => {
    const clean = sanitizeAiContext({
      accessToken: "tok",
      refreshToken: "ref",
      AUTH_SECRET: "secret",
      TURSO_AUTH_TOKEN: "turso",
      googleSub: "sub",
      caption: "safe caption",
    });
    const serialized = JSON.stringify(clean);
    expect(serialized).not.toContain("tok");
    expect(serialized).not.toContain("ref");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("turso");
    expect(clean.googleSub).toBeUndefined();
    expect(clean.caption).toBe("safe caption");
  });

  it("encrypts vault secrets with unique IVs and refuses plaintext payloads", () => {
    const first = encryptSecret("token-one");
    const second = encryptSecret("token-one");
    expect(first).not.toBe(second);
    expect(first.startsWith("v1:")).toBe(true);
    expect(decryptSecret(first)).toBe("token-one");
    expect(() => decryptSecret("plaintext-token")).toThrow(/non-v1/i);
  });

  it("rejects cross-site mutating origins", () => {
    const evil = new Request("http://127.0.0.1:5174/api/publish", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(isAllowedRequestOrigin(evil)).toBe(false);
    const local = new Request("http://127.0.0.1:5174/api/publish", {
      method: "POST",
      headers: { origin: "http://127.0.0.1:5174" },
    });
    expect(isAllowedRequestOrigin(local)).toBe(true);
  });

  it("keeps the allowlist fail-closed", () => {
    expect(isEmailAllowed("stranger@gmail.com")).toBe(false);
    expect(isEmailAllowed("a@example.com")).toBe(true);
  });
});
