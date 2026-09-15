import { NextResponse } from "next/server";
import { initDb } from "../../../../server/db/index.js";
import { enqueueAnalyticsRefresh, processJobQueue } from "../../../../server/jobs/worker.js";
import { JOB_TYPES } from "../../../../server/db/jobs.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    if (!body.accountId) {
      return NextResponse.json({ ok: false, error: "accountId required" }, { status: 400 });
    }
    const job = await enqueueAnalyticsRefresh(body.accountId, {
      campaignId: body.campaignId || null,
      includeContent: Boolean(body.includeContent),
    });
    let processed = null;
    if (body.runNow !== false) {
      processed = await processJobQueue({
        limit: 3,
        types: [JOB_TYPES.REFRESH_ANALYTICS],
      });
    }
    return NextResponse.json({ ok: true, job, processed });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
