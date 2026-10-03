import { initDb } from "../../../../server/db/index.js";
import { processJobQueue } from "../../../../server/jobs/worker.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate, rateLimit, clientKey } from "../../../../server/auth/apiGuard.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  const limited = rateLimit(`jobs:${clientKey(request)}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return deniedJson(limited.error, limited.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const allowedTypes = Array.isArray(body.types)
      ? body.types.filter((type: unknown) => typeof type === "string" && /^[A-Z_]+$/.test(String(type)))
      : null;
    const result = await processJobQueue({
      limit: Math.min(Number(body.limit) || 5, 20),
      types: allowedTypes,
      authz,
    });
    return jsonPrivate({ ok: true, ...result });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not process jobs." }, 500);
  }
}

export async function GET() {
  return jsonPrivate({ ok: false, error: "Method not allowed." }, 405);
}
