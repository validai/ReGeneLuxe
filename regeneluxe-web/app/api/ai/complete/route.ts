import { complete } from "../../../../server/ai.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`ai:${clientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return deniedJson(limited.error, limited.status);
  const body = await request.json().catch(() => ({}));
  const result = await complete(body);
  return jsonPrivate(result.body, result.status);
}
