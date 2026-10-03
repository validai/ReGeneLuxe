import { requireWorkspaceApi, deniedJson, jsonPrivate } from "../../../../server/auth/apiGuard.js";
import { getDbHealth, initDb } from "../../../../server/db/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authz = await requireWorkspaceApi(request);
  if (!authz.ok) return deniedJson(authz.error, authz.status);
  try {
    await initDb();
    const health = await getDbHealth() as {
      ok?: boolean;
      mode?: string;
      schemaVersion?: number;
      sync?: {
        localHealthy?: boolean;
        cloudConfigured?: boolean;
        state?: string;
        lastSyncAt?: string | null;
        pendingOutbox?: number;
        pendingJobs?: number;
      };
    };
    const sync = health.sync ?? {};
    const localHealthy = health.ok !== false && sync.localHealthy !== false;
    return jsonPrivate({
      ok: localHealthy,
      local: {
        healthy: health.ok !== false,
        mode: health.mode ?? null,
        schemaVersion: health.schemaVersion ?? null,
      },
      sync: {
        localHealthy: sync.localHealthy !== false,
        cloudConfigured: Boolean(sync.cloudConfigured),
        state: sync.state || "LOCAL_ONLY",
        lastSyncAt: sync.lastSyncAt || null,
        pendingOutbox: sync.pendingOutbox ?? 0,
        pendingJobs: sync.pendingJobs ?? 0,
      },
    });
  } catch {
    return jsonPrivate({
      ok: false,
      local: { healthy: false },
      sync: { state: "ERROR", cloudConfigured: false, pendingOutbox: 0 },
    }, 503);
  }
}
