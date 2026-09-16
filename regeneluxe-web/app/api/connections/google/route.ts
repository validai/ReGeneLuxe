import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";
import {
  disconnectGmailConnection,
  publicGmailForProfile,
  refreshGmailConnection,
  startGmailAuth,
} from "../../../../server/connectors/gmailConnection.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const YOUTUBE_COPY = "YouTube channel authorization is separate from Google sign-in. Channel attach opens in the next phase.";

export async function GET() {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const gmail = await publicGmailForProfile(result.activeProfile?.id);
  return NextResponse.json({
    ok: true,
    gmail,
    youtube: { kind: "YOUTUBE", status: "NOT_CONNECTED" },
  });
}

export async function POST(request: Request) {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const body = await request.json().catch(() => ({}));
  const kind = String(body.kind || "").toUpperCase();
  const action = String(body.action || "start").toLowerCase();

  if (kind === "YOUTUBE") {
    return NextResponse.json({
      ok: true,
      connected: false,
      status: "NOT_CONNECTED",
      message: YOUTUBE_COPY,
    });
  }

  if (kind !== "GMAIL") {
    return NextResponse.json({ ok: false, error: "Unknown connection." }, { status: 400 });
  }

  if (action === "status") {
    const gmail = await publicGmailForProfile(result.activeProfile?.id);
    return NextResponse.json({ ok: true, gmail });
  }

  if (action === "start") {
    const started = await startGmailAuth({
      operator: result.operator,
      activeProfile: result.activeProfile,
      returnTo: "/settings",
    });
    return NextResponse.json(started, { status: started.ok ? 200 : 400 });
  }

  if (action === "refresh") {
    const refreshed = await refreshGmailConnection({
      operator: result.operator,
      activeProfile: result.activeProfile,
    });
    return NextResponse.json(refreshed, { status: refreshed.ok ? 200 : 400 });
  }

  if (action === "disconnect") {
    const disconnected = await disconnectGmailConnection({
      operator: result.operator,
      activeProfile: result.activeProfile,
    });
    return NextResponse.json(disconnected, { status: disconnected.ok ? 200 : 400 });
  }

  return NextResponse.json({ ok: false, error: "Unknown Gmail action." }, { status: 400 });
}
