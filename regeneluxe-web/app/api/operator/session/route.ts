import { requireOperator, loadConnectionState } from "../../../../server/auth/workspaceSession.js";
import { getDbHealth } from "../../../../server/db/index.js";
import { jsonPrivate, deniedJson } from "../../../../server/auth/apiGuard.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await requireOperator();
  if (!result.ok) {
    return deniedJson(result.error, result.status);
  }

  let health: {
    ok?: boolean;
    error?: string | null;
    sync?: { cloudConfigured?: boolean; state?: string; lastSyncAt?: string | null; pendingOutbox?: number; error?: string | null };
  } | null = null;
  try {
    health = await getDbHealth();
  } catch {
    health = {
      ok: false,
      sync: { state: "ERROR", cloudConfigured: false, pendingOutbox: 0 },
    };
  }

  const connections = await loadConnectionState(result.operator, result.activeProfile);

  return jsonPrivate({
    ok: true,
    operator: result.publicOperator,
    account: result.publicAccount || result.publicOperator,
    workspace: result.publicWorkspace || result.publicActiveProfile,
    profiles: result.publicProfiles,
    activeProfile: result.publicActiveProfile,
    connections: {
      googleAccount: connections.googleAccount,
      gmail: connections.gmail,
      youtube: connections.youtube,
    },
    health: {
      localHealthy: health?.ok !== false,
      cloudConfigured: Boolean(health?.sync?.cloudConfigured),
      syncState: health?.sync?.state || "LOCAL_ONLY",
      lastSyncAt: health?.sync?.lastSyncAt || null,
      pendingOutbox: health?.sync?.pendingOutbox ?? 0,
    },
  });
}
