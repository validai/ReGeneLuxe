import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { buildConnectionCertificationMatrix } from "../../../server/certification/connectionMatrix.js";
import { controlledRealTestsMap } from "../../../server/certification/controlledRealTests.js";
import { assertProviderWriteAllowed } from "../../../server/certification/productionWriteGuard.js";
import { listForProfile } from "../../../server/db/profileMigration.js";
import { COLLECTIONS } from "../../../server/db/index.js";

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
  const matrix = buildConnectionCertificationMatrix({
    workspace: result.workspace,
    accounts,
    controlledRealTests,
  });
  const writeGate = assertProviderWriteAllowed({
    workspace: result.workspace,
    dryRun: false,
  });

  return jsonPrivate({
    ok: true,
    certification: matrix,
    providerWriteGate: {
      allowed: writeGate.ok,
      code: writeGate.code,
      error: writeGate.error || null,
    },
    note: "Read-only certification matrix. No provider writes were performed.",
  });
}
