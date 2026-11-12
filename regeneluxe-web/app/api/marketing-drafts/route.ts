import { listMarketingDrafts } from "../../../server/marketingDrafts/service.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const workspaceId = authz.workspace?.id || authz.activeProfile?.id || null;
  const url = new URL(request.url);
  const filter = url.searchParams.get("filter") || "all";
  const drafts = await listMarketingDrafts({ workspaceId, filter });
  return jsonPrivate({ ok: true, drafts, filter });
}
