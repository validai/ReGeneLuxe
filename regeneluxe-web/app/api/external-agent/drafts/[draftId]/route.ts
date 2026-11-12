import {
  agentReadDraft,
  agentReadSchedule,
  agentUpdateDraft,
} from "../../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../../server/externalAgent/http.js";
import { rateLimit, clientKey } from "../../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string }> };

export async function GET(request: Request, { params }: Params) {
  const { draftId } = await params;
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "schedule") {
    return bridgeJson(await agentReadSchedule(request, draftId));
  }
  return bridgeJson(await agentReadDraft(request, draftId));
}

export async function PATCH(request: Request, { params }: Params) {
  const limited = rateLimit(`external-agent-draft-update:${clientKey(request)}`, { limit: 40, windowMs: 60_000 });
  if (!limited.ok) return bridgeJson({ ok: false, status: limited.status, error: limited.error });
  const { draftId } = await params;
  const body = await request.json().catch(() => ({}));
  return bridgeJson(await agentUpdateDraft(request, draftId, body));
}
