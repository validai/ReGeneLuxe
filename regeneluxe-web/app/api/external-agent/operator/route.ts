import {
  cancelOperatorPairing,
  getBridgeStatus,
  listOperatorProposals,
  reviewOperatorProposal,
  revokeOperatorSession,
  startOperatorPairing,
} from "../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../server/externalAgent/http.js";
import { requireWorkspaceApi, deniedJson, rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const workspaceId = authz.workspace?.id || authz.activeProfile?.id || null;
  const url = new URL(request.url);
  if (url.searchParams.get("view") === "proposals") {
    return bridgeJson(listOperatorProposals({ workspaceId }));
  }
  return bridgeJson(getBridgeStatus(workspaceId));
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`external-agent-operator:${clientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return bridgeJson({ ok: false, status: limited.status, error: limited.error });

  const workspaceId = authz.workspace?.id || authz.activeProfile?.id || null;
  const workspaceName = authz.workspace?.displayName || authz.activeProfile?.displayName || "";
  const operatorId = authz.operator?.id || null;
  const body = await request.json().catch(() => ({}));
  const action = String(body.action || "").trim();

  if (action === "start_pairing") {
    return bridgeJson(startOperatorPairing({
      operatorId,
      workspaceId,
      workspaceName,
      agentKey: body.agentKey || body.agent || null,
      connectionMode: body.connectionMode || body.mode || null,
    }));
  }
  if (action === "cancel_pairing") {
    return bridgeJson(cancelOperatorPairing({ workspaceId }));
  }
  if (action === "revoke_session") {
    return bridgeJson(revokeOperatorSession({ workspaceId }));
  }
  if (action === "accept_proposal" || action === "dismiss_proposal") {
    return bridgeJson(reviewOperatorProposal({
      workspaceId,
      proposalId: body.proposalId,
      status: action === "accept_proposal" ? "accepted" : "dismissed",
      operatorId,
    }));
  }
  return bridgeJson({ ok: false, status: 400, error: "Unknown operator action." });
}
