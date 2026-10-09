import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { SERVICE_NAME, APP_NAME } from "../../../server/config.js";
import { getCanonicalOrigin } from "../../../server/auth/origin.js";
import { getDbHealth, initDb } from "../../../server/db/index.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const status = publicStatus();
  let localHealthy = false;
  let syncState = "UNKNOWN";
  let cloudConfigured = false;
  try {
    await initDb();
    const db = await getDbHealth();
    localHealthy = db?.ok !== false && db?.sync?.localHealthy !== false;
    syncState = db?.sync?.state || "LOCAL_ONLY";
    cloudConfigured = Boolean(db?.sync?.cloudConfigured);
  } catch {
    localHealthy = false;
    syncState = "ERROR";
  }
  return NextResponse.json({
    ok: true,
    app: APP_NAME,
    service: SERVICE_NAME,
    framework: "next",
    canonicalUiUrl: getCanonicalOrigin(),
    state: status.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED",
    running: true,
    aiConfigured: Boolean(status.aiConfigured),
    database: {
      localHealthy,
      sync: { state: syncState, cloudConfigured },
    },
    timestamp: new Date().toISOString(),
  }, { headers: PUBLIC_HEADERS });
}
