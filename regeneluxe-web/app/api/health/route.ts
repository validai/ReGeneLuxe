import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { runtimeIdentity, SERVICE_NAME, APP_NAME } from "../../../server/config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = publicStatus();
  const identity = runtimeIdentity(5174);
  return NextResponse.json({
    ok: true,
    ...identity,
    app: APP_NAME,
    service: SERVICE_NAME,
    framework: "next",
    canonicalUiUrl: "http://127.0.0.1:5174",
    healthUrl: "http://127.0.0.1:5174/api/health",
    apiUrl: "http://127.0.0.1:5174",
    uiPort: 5174,
    apiPort: 5174,
    state: status.aiConfigured ? "RUNNING" : "AI_NOT_CONFIGURED",
    running: true,
    aiConfigured: status.aiConfigured,
    provider: status.provider,
    connectedProviders: status.connectedProviders || [],
    socialConnectionError: false,
    timestamp: new Date().toISOString(),
  });
}
