import { NextResponse } from "next/server";
import {
  enqueueJob,
  getSyncStatus,
  initDb,
  JOB_TYPES,
  pushOutboxToRemote,
} from "../../../server/db/index.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const status = await getSyncStatus();
    return NextResponse.json({ ok: true, ...status });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    if (body?.enqueueOnly) {
      await enqueueJob({
        type: JOB_TYPES.SYNC_REMOTE,
        payload: {},
      });
      return NextResponse.json({ ok: true, enqueued: true });
    }
    const result = await pushOutboxToRemote();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
