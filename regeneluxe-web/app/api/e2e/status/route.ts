import { NextResponse } from "next/server";
import { isE2eAuthEnabled } from "../../../../server/auth/e2eAuthGate.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Probe only — never enables E2E. Canonical runtime must 404. */
export async function GET() {
  if (!isE2eAuthEnabled()) {
    return new NextResponse(null, { status: 404 });
  }
  return NextResponse.json({ ok: true, e2e: true }, { status: 200 });
}
