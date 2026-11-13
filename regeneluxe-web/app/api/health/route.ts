import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { SERVICE_NAME, APP_NAME, uiPort, runtimeIdentity } from "../../../server/config.js";
import { getCanonicalOrigin } from "../../../server/auth/origin.js";
import { getDbHealth, initDb, getMeta } from "../../../server/db/index.js";
import { getTickerHealth } from "../../../server/runtime/jobTickerState.js";
import { PUBLISHING_PAUSE_META_KEY } from "../../../server/marketingDrafts/dispatchPipeline.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const status = publicStatus();
  const identity = runtimeIdentity();
  let localHealthy = false;
  let syncState = "UNKNOWN";
  let cloudConfigured = false;
  let publishingPaused = false;
  const degraded: string[] = [];

  try {
    await initDb();
    const db = await getDbHealth();
    localHealthy = db?.ok !== false && db?.sync?.localHealthy !== false;
    syncState = db?.sync?.state || "LOCAL_ONLY";
    cloudConfigured = Boolean(db?.sync?.cloudConfigured);
    const pauseRaw = await getMeta(PUBLISHING_PAUSE_META_KEY);
    publishingPaused = pauseRaw === "1" || pauseRaw === "true";
  } catch {
    localHealthy = false;
    syncState = "ERROR";
  }

  const ticker = getTickerHealth();
  if (!localHealthy) degraded.push("database");
  if (!status.aiConfigured) degraded.push("ai_not_configured");
  if (process.env.RL_DISABLE_JOB_TICKER === "1") {
    degraded.push("scheduler_disabled");
  } else if (ticker.enabled && ticker.lastTickOk === false) {
    degraded.push("scheduler_last_tick_failed");
  } else if (ticker.enabled && !ticker.lastTickAt) {
    // Boot window — not yet degraded.
  } else if (!ticker.enabled && process.env.NODE_ENV === "production") {
    degraded.push("scheduler_not_started");
  }
  if (syncState === "ERROR" || syncState === "CONFLICT") degraded.push(`sync_${syncState.toLowerCase()}`);

  let healthStatus: "OK" | "DEGRADED" | "UNHEALTHY" = "OK";
  if (!localHealthy) healthStatus = "UNHEALTHY";
  else if (degraded.length > 0) healthStatus = "DEGRADED";

  const ok = healthStatus !== "UNHEALTHY";
  const httpStatus = ok ? 200 : 503;

  return NextResponse.json({
    ok,
    status: healthStatus,
    app: APP_NAME,
    service: SERVICE_NAME,
    framework: "next",
    version: identity.version,
    gitSha: identity.gitSha || process.env.RL_RUNTIME_GIT_SHA || null,
    startedAt: identity.startedAt,
    uiPort: uiPort(),
    canonicalUiUrl: getCanonicalOrigin(),
    authoritativeOrigin: "http://localhost:5174",
    state: status.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED",
    running: ok,
    aiConfigured: Boolean(status.aiConfigured),
    database: {
      localHealthy,
      sync: { state: syncState, cloudConfigured },
    },
    scheduler: {
      ...ticker,
      publishingPaused,
    },
    degradedComponents: degraded,
    timestamp: new Date().toISOString(),
  }, { status: httpStatus, headers: PUBLIC_HEADERS });
}
