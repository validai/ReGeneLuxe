import { closeSession } from "../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../server/externalAgent/http.js";
import { requireAgentSession } from "../../../../server/externalAgent/auth.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = requireAgentSession(request);
  if (!authz.ok) return bridgeJson(authz);
  const session = "session" in authz ? authz.session : null;
  if (!session) return bridgeJson({ ok: false, status: 401, error: "A valid External Agent session is required." });
  return bridgeJson({ ok: true, status: 200, session });
}

export async function DELETE(request: Request) {
  return bridgeJson(closeSession(request));
}
