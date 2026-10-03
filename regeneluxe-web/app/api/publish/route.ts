import { initDb, get, COLLECTIONS } from "../../../server/db/index.js";
import { enqueuePublish, processJobQueue } from "../../../server/jobs/worker.js";
import { JOB_TYPES } from "../../../server/db/jobs.js";
import { buildPublishJobPayload } from "../../../src/data/idempotency.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { recordBelongsToWorkspace, workspaceIdOf } from "../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const { contentId, accountId, approved = false, scheduledAt = null, runNow = true } = body;
    if (!contentId || !accountId) {
      return jsonPrivate({ ok: false, error: "contentId and accountId required" }, 400);
    }

    const content = await get(COLLECTIONS.content, contentId);
    const account = await get(COLLECTIONS.accounts, accountId);
    if (!content || !recordBelongsToWorkspace(content, authz)) {
      return jsonPrivate({ ok: false, error: "Content not found" }, 404);
    }
    if (!account || !recordBelongsToWorkspace(account, authz)) {
      return jsonPrivate({ ok: false, error: "Account not found" }, 404);
    }

    if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
      return jsonPrivate({
        ok: false,
        error: `Account permission is ${account.publishPermission}.`,
      }, 403);
    }

    if (account.publishPermission === "APPROVAL_REQUIRED" && !approved && content.status !== "READY") {
      return jsonPrivate({
        ok: false,
        pendingApproval: true,
        error: "Approval required before publish.",
      }, 409);
    }

    if (account.connectionState !== "CONNECTED") {
      return jsonPrivate({
        ok: false,
        manual: true,
        error: "Unavailable through current connection. Publish on the platform, then mark it published here.",
      }, 503);
    }

    const payload = {
      ...buildPublishJobPayload(content, account, scheduledAt),
      approved: approved || account.publishPermission === "AUTO_PUBLISH" || content.status === "READY",
      managedProfileId: workspaceIdOf(authz),
    };
    const job = await enqueuePublish(payload);
    let processed = null;
    if (runNow) {
      processed = await processJobQueue({ limit: 3, types: [JOB_TYPES.PUBLISH_CONTENT], authz });
    }
    return jsonPrivate({ ok: true, job, processed });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not queue publish." }, 500);
  }
}
