import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-scope-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-scope-key-")), "key");
process.env.RL_DB_MODE = "memory";

const { setAccountTokens, clearAccountTokens } = await import("../secrets/providers.js");
const { YOUTUBE_UPLOAD_SCOPE, YOUTUBE_PILOT_SCOPE_STRING, YOUTUBE_CONNECTION_SCOPE_STRING } = await import("../auth/googleScopes.js");
const {
  buildYoutubeCredentialTruth,
  hasYoutubeUploadScope,
  mergeScopeLists,
  permissionFromScopes,
  permissionLabel,
} = await import("./youtubeScopeTruth.js");
const { buildProviderCertificationRow } = await import("../certification/connectionMatrix.js");
const { listProviderDefinitions } = await import("./registry.js");

const CONN_ID = "conn_yt_settings";
const ACC_ID = "acc_yt_social";

describe("YouTube scope truth model", () => {
  beforeEach(() => {
    clearAccountTokens("youtube", CONN_ID);
    clearAccountTokens("youtube", ACC_ID);
  });

  it("treats readonly credential as read-only, not publish-capable", () => {
    setAccountTokens("youtube", CONN_ID, {
      accessToken: "a",
      refreshToken: "r",
      scopes: YOUTUBE_CONNECTION_SCOPE_STRING.split(" "),
    });
    const truth = buildYoutubeCredentialTruth({
      account: {
        id: ACC_ID,
        connectionState: "CONNECTED",
        providerAccountId: "UC_TEST",
        managedProfileId: "prf_1",
      },
      connection: { id: CONN_ID, connectionState: "CONNECTED", channelId: "UC_TEST" },
      publishImplemented: true,
    });
    expect(truth.UPLOAD_SCOPE_PRESENT).toBe(false);
    expect(truth.PUBLISH_IMPLEMENTED).toBe(true);
    expect(truth.PUBLISH_CAPABLE).toBe(false);
    expect(truth.permission).toBe("readonly");
    expect(permissionLabel(truth.permission)).toBe("Read only");
  });

  it("merges readonly → upload scopes without dropping analytics", () => {
    const merged = mergeScopeLists(
      YOUTUBE_CONNECTION_SCOPE_STRING.split(" "),
      YOUTUBE_PILOT_SCOPE_STRING.split(" "),
    );
    expect(hasYoutubeUploadScope(merged)).toBe(true);
    expect(merged).toContain("https://www.googleapis.com/auth/yt-analytics.readonly");
    expect(permissionFromScopes(merged)).toBe("upload");
  });

  it("certification Publish capable stays false when code can publish but scope is missing", () => {
    setAccountTokens("youtube", CONN_ID, {
      accessToken: "a",
      refreshToken: "r",
      scopes: ["https://www.googleapis.com/auth/youtube.readonly"],
    });
    const definition = listProviderDefinitions().find((row) => row.provider === "youtube");
    const row = buildProviderCertificationRow({
      provider: "youtube",
      workspace: { id: "prf_1", workspacePurpose: "TEST" },
      account: {
        id: ACC_ID,
        platform: "YouTube",
        connectionState: "CONNECTED",
        providerAccountId: "UC_TEST",
        managedProfileId: "prf_1",
      },
      definition,
      youtubeConnection: { id: CONN_ID, channelId: "UC_TEST", connectionState: "CONNECTED" },
    });
    expect(row.publishImplemented).toBe(true);
    expect(row.uploadScopePresent).toBe(false);
    expect(row.publishCapable).toBe(false);
    expect(row.canPublish).toBe(false);
    expect(row.blockers).toContain("YOUTUBE_UPLOAD_SCOPE_MISSING");
    expect(row.readyForControlledPublish).toBe(false);
  });

  it("marks publish capable only when upload scope + identity + implementation align", () => {
    setAccountTokens("youtube", CONN_ID, {
      accessToken: "a",
      refreshToken: "r",
      scopes: YOUTUBE_PILOT_SCOPE_STRING.split(" "),
    });
    const definition = listProviderDefinitions().find((row) => row.provider === "youtube");
    const row = buildProviderCertificationRow({
      provider: "youtube",
      workspace: { id: "prf_1", workspacePurpose: "TEST" },
      account: {
        id: ACC_ID,
        platform: "YouTube",
        connectionState: "CONNECTED",
        providerAccountId: "UC_TEST",
        managedProfileId: "prf_1",
      },
      definition,
      youtubeConnection: { id: CONN_ID, channelId: "UC_TEST", connectionState: "CONNECTED" },
      controlledRealTestPassed: false,
    });
    expect(row.uploadScopePresent).toBe(true);
    expect(row.publishCapable).toBe(true);
    expect(row.canPublish).toBe(true);
    expect(row.readyForControlledPublish).toBe(false);
    expect(row.blockers).toContain("CONTROLLED_REAL_TEST_PENDING");
  });

  it("keeps CERTIFIED false until controlled real test even with upload scope", () => {
    setAccountTokens("youtube", CONN_ID, {
      accessToken: "a",
      refreshToken: "r",
      scopes: [YOUTUBE_UPLOAD_SCOPE, "https://www.googleapis.com/auth/youtube.readonly"],
    });
    const truth = buildYoutubeCredentialTruth({
      account: { id: ACC_ID, connectionState: "CONNECTED", providerAccountId: "UC_TEST" },
      connection: { id: CONN_ID, connectionState: "CONNECTED", channelId: "UC_TEST" },
      publishImplemented: true,
      controlledRealTestPassed: false,
    });
    expect(truth.PUBLISH_CAPABLE).toBe(true);
    expect(truth.CERTIFIED).toBe(false);
  });
});
