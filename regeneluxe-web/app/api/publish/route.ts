import { initDb, get, upsert, COLLECTIONS } from "../../../server/db/index.js";
import { enqueuePublish, processJobQueue } from "../../../server/jobs/worker.js";
import { JOB_TYPES } from "../../../server/db/jobs.js";
import { buildPublishJobPayload, publicationIdempotencyKey } from "../../../src/data/idempotency.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { recordBelongsToWorkspace, workspaceIdOf } from "../../../server/auth/tenantScope.js";
import { normalizeProviderId } from "../../../server/connectors/registry.js";
import {
  buildPublishApproval,
  isPilotProvider,
  publishFingerprint,
  variantForAccount,
} from "../../../src/data/publishApproval.js";
import { createId } from "../../../src/data/ids.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const { contentId, accountId, approvalId = "", scheduledAt = null, runNow = false } = body;
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

    const provider = normalizeProviderId(account.platform);
    if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
      return jsonPrivate({ ok: false, error: `Account permission is ${account.publishPermission}.` }, 403);
    }
    if (account.connectionState !== "CONNECTED") {
      return jsonPrivate({
        ok: false,
        error: "This account is not a verified provider connection.",
      }, 409);
    }

    if (isPilotProvider(provider)) {
      const approval = approvalId ? await get(COLLECTIONS.approvals, approvalId) : null;
      const variant = variantForAccount(content, account);
      if (!approval || approval.consumedAt) {
        return jsonPrivate({ ok: false, error: "FRESH_APPROVAL_REQUIRED" }, 409);
      }
      if (approval.contentFingerprint !== publishFingerprint(variant) || approval.accountId !== account.id) {
        return jsonPrivate({ ok: false, error: "APPROVAL_MISMATCH" }, 409);
      }
    }

    const payload = {
      ...buildPublishJobPayload(content, account, scheduledAt),
      approvalId: approvalId || "",
      operatorId: authz.operator?.id || "",
      managedProfileId: workspaceIdOf(authz),
    };
    const job = await enqueuePublish(payload);
    let processed = null;
    if (runNow) {
      processed = await processJobQueue({ limit: 1, types: [JOB_TYPES.PUBLISH_CONTENT], authz });
    }
    return jsonPrivate({ ok: true, job, processed });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not queue publish." }, 500);
  }
}

export async function PUT(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const content = await get(COLLECTIONS.content, body.contentId);
    const account = await get(COLLECTIONS.accounts, body.accountId);
    if (!content || !recordBelongsToWorkspace(content, authz)) {
      return jsonPrivate({ ok: false, error: "Content not found" }, 404);
    }
    if (!account || !recordBelongsToWorkspace(account, authz)) {
      return jsonPrivate({ ok: false, error: "Account not found" }, 404);
    }
    const provider = normalizeProviderId(account.platform);
    if (!isPilotProvider(provider)) {
      return jsonPrivate({ ok: false, error: "Fresh approval is only required for the live platform pilot." }, 400);
    }
    if (account.connectionState !== "CONNECTED" || !account.providerAccountId) {
      return jsonPrivate({ ok: false, error: "Select a verified destination before approving a post." }, 409);
    }
    const variant = variantForAccount(content, account);
    const approval = buildPublishApproval({
      id: createId("apr"),
      operatorId: authz.operator?.id || "",
      managedProfileId: workspaceIdOf(authz),
      contentId: content.id,
      contentFingerprint: publishFingerprint(variant),
      provider,
      accountId: account.id,
      externalDestinationId: account.providerAccountId,
      mediaId: variant.mediaId,
      mediaRef: variant.mediaRef,
      idempotencyKey: publicationIdempotencyKey({
        contentId: content.id,
        accountId: account.id,
        scheduledAt: body.scheduledAt || content.scheduledAt,
      }),
    });
    await upsert(COLLECTIONS.approvals, approval);
    return jsonPrivate({
      ok: true,
      approval: {
        id: approval.id,
        provider: approval.provider,
        accountId: approval.accountId,
        contentId: approval.contentId,
        externalDestinationId: approval.externalDestinationId,
        expiresAt: approval.expiresAt,
      },
    });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not record approval." }, 500);
  }
}
