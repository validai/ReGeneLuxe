#!/usr/bin/env node
/**
 * Post-OAuth vault inspect for S!xd9 YouTube upload scope.
 * No tokens printed. No provider writes.
 */
import { initDb, list, COLLECTIONS } from "../server/db/index.js";
import { getManagedProfile, getProfileConnectionByKind } from "../server/db/managedProfileRepository.js";
import { PROFILE_CONNECTION_KINDS } from "../src/data/profileModels.js";
import { buildYoutubeCredentialTruth } from "../server/connectors/youtubeScopeTruth.js";
import { publicYoutubeForProfile, refreshYoutubePermissionFromVault } from "../server/connectors/youtubeConnection.js";
import { buildConnectionCertificationMatrix } from "../server/certification/connectionMatrix.js";
import { YOUTUBE_UPLOAD_SCOPE } from "../server/auth/googleScopes.js";

const SIXD9 = "de5d366a-393f-4f30-a4f3-5d9b397a4340";
const EXPECTED_CHANNEL = "UCYidjTSc8KzJYRnB3PvVDdQ";
const EXPECTED_HANDLE = "@sixd9";

await initDb();
const ws = await getManagedProfile(SIXD9);
let conn = await getProfileConnectionByKind(SIXD9, PROFILE_CONNECTION_KINDS.YOUTUBE);
if (conn) conn = await refreshYoutubePermissionFromVault(conn);
const accounts = (await list(COLLECTIONS.accounts)).filter((a) => a.managedProfileId === SIXD9);
const ytAcc = accounts.find((a) => String(a.platform || "").toLowerCase() === "youtube");
const truth = buildYoutubeCredentialTruth({ account: ytAcc, connection: conn, publishImplemented: true });
const pub = await publicYoutubeForProfile(SIXD9);
const matrix = buildConnectionCertificationMatrix({
  workspace: ws,
  accounts,
  youtubeConnection: conn,
});
const yt = matrix.providers.find((r) => r.provider === "youtube");
const channelId = conn?.channelId || ytAcc?.providerAccountId || ytAcc?.externalAccountId || "";
const handle = conn?.channelHandle || ytAcc?.handle || "";
const uploadPresent = truth.scopes.includes(YOUTUBE_UPLOAD_SCOPE);
const channelUnchanged = channelId === EXPECTED_CHANNEL
  && String(handle).replace(/^@/, "").toLowerCase() === EXPECTED_HANDLE.replace(/^@/, "").toLowerCase();

const report = {
  ok: true,
  workspace: { id: ws?.id, purpose: ws?.workspacePurpose, name: ws?.displayName },
  ACTUAL_GRANTED_SCOPES: truth.scopes,
  uploadPresent,
  channel: { id: channelId, handle, title: conn?.channelTitle || ytAcc?.displayName || "" },
  channelUnchanged,
  classification: {
    IDENTITY_CONNECTED: truth.IDENTITY_CONNECTED,
    READ_CONNECTED: truth.READ_CONNECTED,
    UPLOAD_SCOPE_PRESENT: truth.UPLOAD_SCOPE_PRESENT,
    PUBLISH_IMPLEMENTED: truth.PUBLISH_IMPLEMENTED,
    PUBLISH_CAPABLE: truth.PUBLISH_CAPABLE,
    SCHEDULE_CAPABLE: truth.SCHEDULE_CAPABLE,
    CERTIFIED: truth.CERTIFIED,
  },
  settings: { permission: pub.permission, label: pub.permissionLabel },
  matrix: {
    publishCapable: yt?.publishCapable,
    publishImplemented: yt?.publishImplemented,
    ready: yt?.readyForControlledPublish,
    blockers: yt?.blockers,
    status: yt?.status,
  },
  next: uploadPresent
    ? "BEGIN_YOUTUBE_PRIVATE_CERTIFICATION"
    : "DIAGNOSE_INTERNALLY_NO_OPERATOR_RETRY",
  REGENELUXE_48H_CERT_STATUS: uploadPresent
    ? "YOUTUBE_UPLOAD_SCOPE_PRESENT_BEGIN_CERT"
    : "YOUTUBE_UPLOAD_SCOPE_STILL_ABSENT",
};

console.log(JSON.stringify(report, null, 2));
console.log(report.REGENELUXE_48H_CERT_STATUS);
process.exit(uploadPresent && channelUnchanged ? 0 : 2);
