import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { SERVICE_NAME } from "../../../server/config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = publicStatus();
  return NextResponse.json({
    running: status.running,
    aiConfigured: Boolean(status.aiConfigured),
    provider: status.provider || null,
    connectedProviders: status.connectedProviders || [],
    providerAppsConfigured: status.providerAppsConfigured || [],
    service: SERVICE_NAME,
  }, {
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
