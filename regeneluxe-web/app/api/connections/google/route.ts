import { NextResponse } from "next/server";
import { requireOperator } from "../../../../server/auth/workspaceSession.js";
import {
  disconnectGmailConnection,
  publicGmailForProfile,
  refreshGmailConnection,
  startGmailAuth,
} from "../../../../server/connectors/gmailConnection.js";
import {
  disconnectYoutubeConnection,
  publicYoutubeForProfile,
  selectYoutubeChannel,
  startYoutubeAuth,
  syncYoutubeChannel,
} from "../../../../server/connectors/youtubeConnection.js";
import { getProfileConnectionByKind } from "../../../../server/db/managedProfileRepository.js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await requireOperator();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  const gmail = await publicGmailForProfile(result.activeProfile?.id);
  const youtube = await publicYoutubeForProfile(result.activeProfile?.id);
  return NextResponse.json({
    ok: true,
    operator: { email: result.operator.email, name: result.operator.name },
    gmail,
    youtube,
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
    if (action === "status") {
      return NextResponse.json({ ok: true, youtube: await publicYoutubeForProfile(result.activeProfile?.id) });
    }
    if (action === "start") {
      const started = await startYoutubeAuth({
        operator: result.operator,
        activeProfile: result.activeProfile,
        returnTo: "/settings",
      });
      return NextResponse.json(started, { status: started.ok ? 200 : 400 });
    }
    if (action === "select") {
      const selected = await selectYoutubeChannel({
        operator: result.operator,
        activeProfile: result.activeProfile,
        channelId: body.channelId,
      });
      return NextResponse.json(selected, { status: selected.ok ? 200 : 400 });
    }
    if (action === "refresh" || action === "sync") {
      const connection = await getProfileConnectionByKind(result.activeProfile?.id, "YOUTUBE");
      const synced = await syncYoutubeChannel({ connection });
      return NextResponse.json(synced, { status: synced.ok ? 200 : 400 });
    }
    if (action === "disconnect") {
      const disconnected = await disconnectYoutubeConnection({
        operator: result.operator,
        activeProfile: result.activeProfile,
      });
      return NextResponse.json(disconnected, { status: disconnected.ok ? 200 : 400 });
    }
    return NextResponse.json({ ok: false, error: "Unknown YouTube action." }, { status: 400 });
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

  if (action === "refresh" || action === "sync") {
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
