import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  initDb,
} from "../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";
import { stripSecretFields } from "../../../src/data/secretFields.js";
import { workspaceIdOf } from "../../../server/auth/tenantScope.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const snapshot = stripSecretFields(await exportDatabaseSnapshot({
      workspaceId: workspaceIdOf(authz),
      operatorId: authz.operator.id,
    }));
    return jsonPrivate(snapshot);
  } catch {
    return jsonPrivate({ ok: false, error: "Could not export backup." }, 500);
  }
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json();
    const result = await importDatabaseSnapshot(body, {
      workspaceId: workspaceIdOf(authz),
      operatorId: authz.operator.id,
    });
    return jsonPrivate({ ...result, ok: result.ok !== false });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not import backup." }, 500);
  }
}
