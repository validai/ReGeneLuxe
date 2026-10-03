import { initDb } from "../../../../server/db/index.js";
import { enqueueAnalyticsRefresh, processJobQueue } from "../../../../server/jobs/worker.js";
import { JOB_TYPES } from "../../../../server/db/jobs.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import { get } from "../../../../server/db/index.js";
import { COLLECTIONS } from "../../../../server/db/collections.js";
import { recordBelongsToWorkspace, workspaceIdOf } from "../../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    if (!body.accountId) {
      return jsonPrivate({ ok: false, error: "accountId required" }, 400);
    }
    const account = await get(COLLECTIONS.accounts, body.accountId);
    if (!account || !recordBelongsToWorkspace(account, authz)) {
      return jsonPrivate({ ok: false, error: "Account not found" }, 404);
    }
    const job = await enqueueAnalyticsRefresh(body.accountId, {
      campaignId: body.campaignId || null,
      includeContent: Boolean(body.includeContent),
      managedProfileId: workspaceIdOf(authz),
    });
    let processed = null;
    if (body.runNow !== false) {
      processed = await processJobQueue({
        limit: 3,
        types: [JOB_TYPES.REFRESH_ANALYTICS],
        authz,
      });
    }
    return jsonPrivate({ ok: true, job, processed });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not refresh analytics." }, 500);
  }
}
