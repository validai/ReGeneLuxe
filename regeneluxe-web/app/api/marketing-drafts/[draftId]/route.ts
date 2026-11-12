import {
  assignDraftSchedule,
  getMarketingDraft,
  operatorReviewDraft,
} from "../../../../server/marketingDrafts/service.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, { params }: Params) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const workspaceId = authz.workspace?.id || authz.activeProfile?.id || null;
  const { draftId } = await params;
  const draft = await getMarketingDraft(draftId, { workspaceId });
  if (!draft) return deniedJson("Draft not found.", 404);
  return jsonPrivate({ ok: true, draft });
}

export async function POST(request: Request, { params }: Params) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`marketing-draft-review:${clientKey(request)}`, { limit: 40, windowMs: 60_000 });
  if (!limited.ok) return jsonPrivate({ ok: false, error: limited.error }, limited.status);

  const workspaceId = authz.workspace?.id || authz.activeProfile?.id || null;
  const operatorId = authz.operator?.id || null;
  const { draftId } = await params;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim().toUpperCase();

  if (action === "ASSIGN_SCHEDULE") {
    const result = await assignDraftSchedule(draftId, {
      workspaceId,
      operatorId,
      scheduledFor: body.scheduledFor,
      approvalDeadline: body.approvalDeadline || null,
      timezone: body.timezone || null,
    });
    return jsonPrivate(result, result.status || (result.ok ? 200 : 400));
  }

  if (["APPROVE", "REQUEST_CHANGES", "SKIP"].includes(action)) {
    const result = await operatorReviewDraft(draftId, {
      workspaceId,
      operatorId,
      action,
      notes: body.notes || "",
      scheduledFor: body.scheduledFor,
    });
    return jsonPrivate(result, result.status || (result.ok ? 200 : 400));
  }

  return jsonPrivate({ ok: false, error: "Unknown action." }, 400);
}
