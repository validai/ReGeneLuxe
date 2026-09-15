import { NextResponse } from "next/server";
import {
  enqueueJob,
  getSyncStatus,
  initDb,
  JOB_TYPES,
  pushOutboxToRemote,
  pullRemoteToLocal,
  reconcileWithRemote,
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
        payload: { pull: body.pull !== false, push: body.push !== false },
      });
      return NextResponse.json({ ok: true, enqueued: true });
    }

    if (body?.pull && body?.push !== false) {
      const result = await reconcileWithRemote();
      const status = await getSyncStatus();
      return NextResponse.json({ ok: true, ...result, status });
    }

    if (body?.pull && body?.push === false) {
      const pull = await pullRemoteToLocal();
      const status = await getSyncStatus();
      return NextResponse.json({ ok: true, pull, status });
    }

    if (body?.push === false && body?.pull === false) {
      const status = await getSyncStatus();
      return NextResponse.json({ ok: true, status });
    }

    // Default: push outbox (backward compatible). Prefer reconcile via { pull: true }.
    const result = body?.pull
      ? await reconcileWithRemote()
      : { push: await pushOutboxToRemote() };
    const status = await getSyncStatus();
    return NextResponse.json({ ok: true, ...result, status });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
