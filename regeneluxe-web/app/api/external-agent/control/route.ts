import { denyControlAttempt } from "../../../../server/externalAgent/bridge.js";
import { bridgeJson } from "../../../../server/externalAgent/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Explicit deny endpoint so control attempts are audited instead of silently 404ing. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || body?.command || "control").slice(0, 80);
  return bridgeJson(denyControlAttempt(request, action));
}

export async function PUT(request: Request) {
  return POST(request);
}

export async function PATCH(request: Request) {
  return POST(request);
}

export async function DELETE(request: Request) {
  return POST(request);
}
