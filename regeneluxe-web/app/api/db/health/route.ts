import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import { getDbHealth, initDb } from "../../../../server/db/index.js";
import { toClientDbHealth } from "../../../../server/db/healthPayload.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    return jsonPrivate(toClientDbHealth(await getDbHealth()));
  } catch (error) {
    return jsonPrivate(toClientDbHealth(null, {
      fetchFailed: true,
      error: error instanceof Error ? error.message : "Database health unavailable",
    }), 503);
  }
}
