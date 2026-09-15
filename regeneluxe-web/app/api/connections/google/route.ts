import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const COPY = {
  GMAIL: "Gmail access is a separate authorization from Google sign-in. Mailbox connection opens in the next phase.",
  YOUTUBE: "YouTube channel authorization is separate from Google sign-in. Channel attach opens in the next phase.",
};

export async function POST(request: Request) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "").toUpperCase();
  if (kind !== "GMAIL" && kind !== "YOUTUBE") {
    return NextResponse.json({ ok: false, error: "Unknown connection." }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    connected: false,
    status: "NOT_CONNECTED",
    message: COPY[kind],
  });
}
