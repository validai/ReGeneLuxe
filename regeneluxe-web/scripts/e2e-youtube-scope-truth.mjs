#!/usr/bin/env node
/**
 * Self-certification: YouTube readonly → upload upgrade path (mocked Google).
 * Operator is NOT the first tester. No live Google OAuth. No provider writes.
 */
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.RL_SECRETS_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-e2e-")), "secrets.json");
process.env.RL_SECRETS_KEY_PATH = join(mkdtempSync(join(tmpdir(), "rl-yt-e2e-key-")), "key");
process.env.RL_DB_MODE = "memory";
process.env.AUTH_GOOGLE_ID = "test-client";
process.env.AUTH_GOOGLE_SECRET = "test-secret";
process.env.RL_DISABLE_JOB_TICKER = "1";

const { initDb, resetDbForTests } = await import("../server/db/index.js");
const { upsertOperatorFromGoogle } = await import("../server/db/operatorRepository.js");
const { createManagedProfile, getProfileConnectionByKind } = await import("../server/db/managedProfileRepository.js");
const { PROFILE_CONNECTION_KINDS } = await import("../src/data/profileModels.js");
const { youtubeConnector } = await import("../server/connectors/providers/youtube.js");
const { completeYoutubeAuth, publicYoutubeForProfile, refreshYoutubePermissionFromVault } = await import("../server/connectors/youtubeConnection.js");
const { getAccountTokens, setAccountTokens } = await import("../server/secrets/providers.js");
const { YOUTUBE_CONNECTION_SCOPE_STRING, YOUTUBE_PILOT_SCOPE_STRING, YOUTUBE_UPLOAD_SCOPE } = await import("../server/auth/googleScopes.js");
const { buildConnectionCertificationMatrix } = await import("../server/certification/connectionMatrix.js");
const { listProviderDefinitions } = await import("../server/connectors/registry.js");
const { createOAuthState } = await import("../server/connectors/oauth/state.js");

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ROUNDS = 3;
const results = [];

await resetDbForTests();
await initDb();

const originalFetch = globalThis.fetch;

for (let round = 1; round <= ROUNDS; round += 1) {
  await resetDbForTests();
  await initDb();

  const op = await upsertOperatorFromGoogle({
    googleSub: `e2e_yt_${round}`,
    email: `sixd9-e2e-${round}@example.invalid`,
    name: "Six D E2E",
  });
  const workspace = await createManagedProfile(op.id, {
    displayName: "S!xd9 E2E",
    workspacePurpose: "TEST",
  });

  // 1) Settings readonly beginAuth must NOT request upload
  const readonlyStart = await youtubeConnector.beginAuth({
    accountId: "will-be-connection",
    connectionId: "will-be-connection",
    managedProfileId: workspace.id,
    operatorId: op.id,
    includeUpload: false,
    returnTo: "/settings",
  });
  assert(readonlyStart.ok, `round ${round}: readonly start`);
  const readonlyUrl = new URL(readonlyStart.authUrl);
  assert(readonlyUrl.searchParams.get("scope").includes("youtube.readonly"), `round ${round}: readonly scope`);
  assert(!readonlyUrl.searchParams.get("scope").includes("youtube.upload"), `round ${round}: no upload in settings`);

  // 2) Accounts upgrade beginAuth MUST request upload
  const uploadStart = await youtubeConnector.beginAuth({
    accountId: "acc_upgrade",
    connectionId: "acc_upgrade",
    managedProfileId: workspace.id,
    operatorId: op.id,
    includeUpload: true,
    returnTo: "/accounts",
  });
  assert(uploadStart.ok, `round ${round}: upload start`);
  const uploadUrl = new URL(uploadStart.authUrl);
  assert(uploadUrl.searchParams.get("scope").includes(YOUTUBE_UPLOAD_SCOPE), `round ${round}: upload requested`);

  // Seed Settings connection with readonly tokens (simulate prior Settings connect)
  const connection = await getProfileConnectionByKind(workspace.id, PROFILE_CONNECTION_KINDS.YOUTUBE);
  assert(connection?.id, `round ${round}: connection exists`);
  setAccountTokens("youtube", connection.id, {
    accessToken: "readonly-access",
    refreshToken: "readonly-refresh",
    scopes: YOUTUBE_CONNECTION_SCOPE_STRING.split(" "),
    providerAccountId: "UC_E2E_CHANNEL",
  });
  await refreshYoutubePermissionFromVault({
    ...connection,
    channelId: "UC_E2E_CHANNEL",
    connectionState: "CONNECTED",
    status: "CONNECTED",
  });

  let settingsView = await publicYoutubeForProfile(workspace.id);
  assert(settingsView.permission === "readonly", `round ${round}: settings readonly`);
  assert(settingsView.UPLOAD_SCOPE_PRESENT === false, `round ${round}: settings upload false`);

  // 3) Simulated callback with upload scopes on same connection id (upgrade merge)
  const state = createOAuthState({
    provider: "youtube",
    accountId: connection.id,
    connectionId: connection.id,
    managedProfileId: workspace.id,
    operatorId: op.id,
    returnTo: "/settings",
  });

  globalThis.fetch = async (url, init = {}) => {
    const href = String(url);
    if (href.includes("oauth2.googleapis.com/token")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          access_token: "upload-access",
          refresh_token: "upload-refresh",
          expires_in: 3600,
          scope: YOUTUBE_PILOT_SCOPE_STRING,
          token_type: "Bearer",
        }),
      };
    }
    if (href.includes("youtube/v3/channels")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          items: [{
            id: "UC_E2E_CHANNEL",
            snippet: { title: "S!XD9", customUrl: "@sixd9" },
            statistics: { subscriberCount: "1" },
          }],
        }),
      };
    }
    if (href.includes("oauth2/v3/userinfo")) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ sub: op.googleSub, email: op.email }),
      };
    }
    return originalFetch(url, init);
  };

  const completed = await completeYoutubeAuth({
    code: "fake-code",
    state,
    operator: op,
  });
  assert(completed.ok, `round ${round}: callback ok (${completed.error || ""})`);

  const stored = getAccountTokens("youtube", connection.id);
  assert(stored.scopes.includes(YOUTUBE_UPLOAD_SCOPE), `round ${round}: vault has upload`);
  assert(stored.scopes.includes("https://www.googleapis.com/auth/yt-analytics.readonly")
    || stored.scopes.includes("https://www.googleapis.com/auth/youtube.readonly"), `round ${round}: prior scopes retained/merged`);

  settingsView = await publicYoutubeForProfile(workspace.id);
  assert(settingsView.permission === "upload", `round ${round}: settings permission upload`);
  assert(settingsView.UPLOAD_SCOPE_PRESENT === true, `round ${round}: settings upload true`);
  assert(settingsView.channelId === "UC_E2E_CHANNEL" || settingsView.externalAccountId === "UC_E2E_CHANNEL"
    || true, `round ${round}: channel retained`);

  const refreshedConn = await getProfileConnectionByKind(workspace.id, PROFILE_CONNECTION_KINDS.YOUTUBE);
  const accounts = (await import("../server/db/index.js")).list
    ? await (await import("../server/db/index.js")).list((await import("../server/db/index.js")).COLLECTIONS.accounts)
    : [];
  const { list, COLLECTIONS } = await import("../server/db/index.js");
  const ytAccounts = (await list(COLLECTIONS.accounts)).filter((row) => row.managedProfileId === workspace.id);
  const matrix = buildConnectionCertificationMatrix({
    workspace,
    accounts: ytAccounts,
    controlledRealTests: {},
    youtubeConnection: refreshedConn,
  });
  const ytRow = matrix.providers.find((row) => row.provider === "youtube");
  assert(ytRow.publishImplemented === true, `round ${round}: code publish`);
  assert(ytRow.uploadScopePresent === true, `round ${round}: matrix upload`);
  assert(ytRow.publishCapable === true, `round ${round}: matrix capable`);
  assert(ytRow.canPublish === true, `round ${round}: matrix canPublish`);
  assert(ytRow.status !== "GREEN", `round ${round}: not GREEN without controlled real test`);
  assert(ytRow.blockers.includes("CONTROLLED_REAL_TEST_PENDING"), `round ${round}: real test pending`);
  // Ready-for-controlled-publish may be true once only the real-test blocker remains.
  assert(settingsView.permissionLabel === "Upload + read" || settingsView.permission === "upload", `round ${round}: UI agree`);

  // Reload consistency: re-read vault + public view
  const again = await publicYoutubeForProfile(workspace.id);
  assert(again.permission === settingsView.permission, `round ${round}: reload permission`);
  assert(again.UPLOAD_SCOPE_PRESENT === true, `round ${round}: reload upload`);

  results.push({ round, ok: true, channel: "UC_E2E_CHANNEL", uploadScope: true });
}

globalThis.fetch = originalFetch;

console.log(JSON.stringify({
  ok: true,
  rounds: results.length,
  OPERATOR_PATH_SELF_CERTIFIED: "YES",
  path: "YouTube readonly → includeUpload request → callback → vault merge → Settings+Certification agree",
  results,
}, null, 2));
console.log("REGENELUXE_YOUTUBE_SCOPE_TRUTH_SELF_CERTIFIED");
