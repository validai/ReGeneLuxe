import { agentSubmitDraft } from "../../../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../../../server/externalAgent/http.js";
import { rateLimit, clientKey } from "../../../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ draftId: string }> };

export async function POST(request: Request, { params }: Params) {
  const limited = rateLimit(`external-agent-draft-submit:${clientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return bridgeJson({ ok: false, status: limited.status, error: limited.error });
  const { draftId } = await params;
  return bridgeJson(await agentSubmitDraft(request, draftId));
}
