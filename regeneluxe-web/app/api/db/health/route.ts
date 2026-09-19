import { NextResponse } from "next/server";
import { getDbHealth, initDb } from "../../../../server/db/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const health = await getDbHealth() as {
      ok?: boolean;
      mode?: string;
      schemaVersion?: number;
      error?: string | null;
      sync?: {
        localHealthy?: boolean;
        cloudConfigured?: boolean;
        state?: string;
        lastSyncAt?: string | null;
        pendingOutbox?: number;
        pendingJobs?: number;
        error?: string | null;
      };
    };
    const sync = health.sync ?? {};
    const localHealthy = health.ok !== false && sync.localHealthy !== false;
    return NextResponse.json({
      ok: localHealthy,
      local: {
        healthy: health.ok !== false,
        mode: health.mode ?? null,
        schemaVersion: health.schemaVersion ?? null,
        error: health.error ?? null,
      },
      sync,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      local: { healthy: false, error: error instanceof Error ? error.message : String(error) },
      sync: { state: "ERROR", cloudConfigured: false, pendingOutbox: 0 },
    }, { status: 503 });
  }
}
