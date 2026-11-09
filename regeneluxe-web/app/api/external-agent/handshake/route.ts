import { beginHandshake, getBridgeStatus } from "../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../server/externalAgent/http.js";
import { rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return bridgeJson(getBridgeStatus());
}

export async function POST(request: Request) {
  const limited = rateLimit(`external-agent-handshake:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return bridgeJson({ ok: false, status: limited.status, error: limited.error });
  const body = await request.json().catch(() => ({}));
  return bridgeJson(beginHandshake(request, body));
}
