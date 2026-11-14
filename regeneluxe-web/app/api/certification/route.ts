import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { buildConnectionCertificationMatrix } from "../../../server/certification/connectionMatrix.js";
import { controlledRealTestsMap } from "../../../server/certification/controlledRealTests.js";
import { assertProviderWriteAllowed } from "../../../server/certification/productionWriteGuard.js";
import { buildPublishingCoverageMatrix } from "../../../server/certification/publishingCoverageMatrix.js";
import { buildYoutubeCredentialTruth } from "../../../server/connectors/youtubeScopeTruth.js";
import { listForProfile } from "../../../server/db/profileMigration.js";
import { COLLECTIONS } from "../../../server/db/index.js";
import { getProfileConnectionByKind } from "../../../server/db/managedProfileRepository.js";
import { refreshYoutubePermissionFromVault } from "../../../server/connectors/youtubeConnection.js";
import { PROFILE_CONNECTION_KINDS } from "../../../src/data/profileModels.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const result = await requireWorkspaceApi(request);
  if (!result.ok) return deniedJson(result.error, result.status);
  if (!result.workspace) {
    return jsonPrivate({ ok: false, error: "Create a ReGeneLuxe profile before running certification." }, 400);
  }

  const accounts = await listForProfile(COLLECTIONS.accounts, result.workspace.id);
  const controlledRealTests = controlledRealTestsMap(result.workspace.id);
  let youtubeConnection = await getProfileConnectionByKind(result.workspace.id, PROFILE_CONNECTION_KINDS.YOUTUBE);
  if (youtubeConnection) {
    youtubeConnection = await refreshYoutubePermissionFromVault(youtubeConnection);
  }
  const matrix = buildConnectionCertificationMatrix({
    workspace: result.workspace,
    accounts,
    controlledRealTests,
    youtubeConnection,
  });
  const writeGate = assertProviderWriteAllowed({
    workspace: result.workspace,
    dryRun: false,
  });

  const ytAccount = accounts.find((row: { platform?: string }) => String(row.platform || "").toLowerCase() === "youtube") || null;
  const ytTruth = buildYoutubeCredentialTruth({
    account: ytAccount,
    connection: youtubeConnection,
    publishImplemented: true,
  });
  const publishingCoverage = buildPublishingCoverageMatrix({
    credentialAuthorizedByProvider: {
      youtube: Boolean(ytTruth.UPLOAD_SCOPE_PRESENT),
    },
    certifiedByKey: {},
  });

  return jsonPrivate({
    ok: true,
    certification: matrix,
    publishingCoverage,
    providerWriteGate: {
      allowed: writeGate.ok,
      code: writeGate.code,
      error: writeGate.error || null,
    },
    note: "Read-only matrices. Publish capable ≠ code exists. Content-type CERTIFIED requires controlled real tests. No provider writes.",
  });
}
