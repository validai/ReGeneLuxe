import { setAiSecret } from "../../../server/secrets.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey } from "../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`secrets:${clientKey(request)}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return deniedJson(limited.error, limited.status);
  const body = await request.json().catch(() => ({}));
  if (body?.kind !== "ai") {
    return jsonPrivate({ ok: false, error: "Unsupported secret kind" }, 400);
  }
  const result = setAiSecret(body.provider, body.value);
  return jsonPrivate({ ok: true, ...result });
}
