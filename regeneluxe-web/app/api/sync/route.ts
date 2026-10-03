import {
  enqueueJob,
  getSyncStatus,
  initDb,
  JOB_TYPES,
  pushOutboxToRemote,
  pullRemoteToLocal,
  reconcileWithRemote,
} from "../../../server/db/index.js";
import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../server/auth/apiGuard.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const status = await getSyncStatus();
    return jsonPrivate({ ok: true, ...status });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not read sync status." }, 500);
  }
}

export async function POST(request: Request) {
  const authz = await requireWorkspaceApi(request, { mutate: true });
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    if (body?.enqueueOnly) {
      await enqueueJob({
        type: JOB_TYPES.SYNC_REMOTE,
        payload: { pull: body.pull !== false, push: body.push !== false },
      });
      return jsonPrivate({ ok: true, enqueued: true });
    }

    if (body?.pull && body?.push !== false) {
      const result = await reconcileWithRemote();
      const status = await getSyncStatus();
      return jsonPrivate({ ok: true, ...result, status });
    }

    if (body?.pull && body?.push === false) {
      const pull = await pullRemoteToLocal();
      const status = await getSyncStatus();
      return jsonPrivate({ ok: true, pull, status });
    }

    if (body?.push === false && body?.pull === false) {
      const status = await getSyncStatus();
      return jsonPrivate({ ok: true, status });
    }

    const result = body?.pull
      ? await reconcileWithRemote()
      : { push: await pushOutboxToRemote() };
    const status = await getSyncStatus();
    return jsonPrivate({ ok: true, ...result, status });
  } catch {
    return jsonPrivate({ ok: false, error: "Could not sync." }, 500);
  }
}
