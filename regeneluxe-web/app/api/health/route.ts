import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { SERVICE_NAME, APP_NAME, uiPort, runtimeIdentity } from "../../../server/config.js";
import { getCanonicalOrigin } from "../../../server/auth/origin.js";
import { getDbHealth, initDb, getMeta } from "../../../server/db/index.js";
import { getTickerHealth } from "../../../server/runtime/jobTickerState.js";
import {
  classifyHealthComponents,
  describeHealthForOperator,
} from "../../../server/runtime/healthClassification.js";
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
  const classified = classifyHealthComponents({
    localHealthy,
    aiConfigured: Boolean(status.aiConfigured),
    syncState,
    schedulerDisabled: process.env.RL_DISABLE_JOB_TICKER === "1",
    schedulerEnabled: Boolean(ticker.enabled),
    schedulerLastTickOk: ticker.lastTickOk,
    productionRuntime: process.env.NODE_ENV === "production",
  });

  const operatorView = describeHealthForOperator({
    status: classified.status,
    aiConfigured: Boolean(status.aiConfigured),
    coreOperational: classified.coreOperational,
  });

  const httpStatus = classified.ok ? 200 : 503;

  return NextResponse.json({
    ok: classified.ok,
    status: classified.status,
    app: APP_NAME,
    service: SERVICE_NAME,
    framework: "next",
    version: identity.version,
    gitSha: identity.gitSha || process.env.RL_RUNTIME_GIT_SHA || null,
    startedAt: identity.startedAt,
    uiPort: uiPort(),
    canonicalUiUrl: getCanonicalOrigin(),
    authoritativeOrigin: "http://localhost:5174",
    /** Informational AI vault flag — not a core runtime state. */
    state: classified.coreOperational ? "RUNNING" : "UNAVAILABLE",
    aiState: status.aiConfigured ? "CONFIGURED" : "NOT_CONFIGURED",
    running: classified.ok,
    coreOperational: classified.coreOperational,
    aiConfigured: Boolean(status.aiConfigured),
    aiOptional: true,
    database: {
      localHealthy,
      sync: { state: syncState, cloudConfigured },
    },
    scheduler: {
      ...ticker,
      publishingPaused,
    },
    degradedComponents: classified.degradedComponents,
    optionalComponents: classified.optionalComponents,
    operator: operatorView,
    timestamp: new Date().toISOString(),
  }, { status: httpStatus, headers: PUBLIC_HEADERS });
}
