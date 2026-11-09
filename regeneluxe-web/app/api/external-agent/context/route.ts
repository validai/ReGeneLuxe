import { readContext } from "../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../server/externalAgent/http.js";
import { rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const limited = rateLimit(`external-agent-context:${clientKey(request)}`, { limit: 30, windowMs: 60_000 });
  if (!limited.ok) return bridgeJson({ ok: false, status: limited.status, error: limited.error });
  return bridgeJson(await readContext(request));
}
