import { initDb, migrateLocalStorageDump } from "../../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json();
    const dump = body?.dump && typeof body.dump === "object" ? body.dump : body;
    const result = await migrateLocalStorageDump(dump);
    return jsonPrivate({ ok: true, ...result });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not migrate local data." }, 500);
  }
}
