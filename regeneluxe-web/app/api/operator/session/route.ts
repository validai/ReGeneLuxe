import { NextResponse } from "next/server";
import { requireOperator, loadConnectionState } from "../../../../server/auth/workspaceSession.js";
import { getDbHealth } from "../../../../server/db/index.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  let health = null;
  try {
    health = await getDbHealth();
  } catch (error) {
    health = {
      ok: false,
      error: error instanceof Error ? error.message : "Local database unavailable",
      sync: { state: "ERROR", cloudConfigured: false, pendingOutbox: 0 },
    };
  }

  const connections = await loadConnectionState(result.operator, result.activeProfile);

  return NextResponse.json({
    ok: true,
    operator: result.publicOperator,
    profiles: result.publicProfiles,
    activeProfile: result.publicActiveProfile,
    connections: {
      googleAccount: connections.googleAccount,
      gmail: connections.gmail,
      youtube: { kind: "YOUTUBE", status: connections.youtube.status },
    },
    health: {
      localHealthy: health?.ok !== false,
      cloudConfigured: Boolean(health?.sync?.cloudConfigured),
      syncState: health?.sync?.state || "LOCAL_ONLY",
      lastSyncAt: health?.sync?.lastSyncAt || null,
      pendingOutbox: health?.sync?.pendingOutbox ?? 0,
      error: health?.error || health?.sync?.error || null,
    },
  });
}
