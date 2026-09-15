import { NextResponse } from "next/server";
import { initDb, get, COLLECTIONS } from "../../../server/db/index.js";
import { enqueuePublish, processJobQueue } from "../../../server/jobs/worker.js";
import { JOB_TYPES } from "../../../server/db/jobs.js";
import { buildPublishJobPayload } from "../../../src/data/idempotency.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const { contentId, accountId, approved = false, scheduledAt = null, runNow = true } = body;
    if (!contentId || !accountId) {
      return NextResponse.json({ ok: false, error: "contentId and accountId required" }, { status: 400 });
    }

    const content = await get(COLLECTIONS.content, contentId);
    const account = await get(COLLECTIONS.accounts, accountId);
    if (!content) return NextResponse.json({ ok: false, error: "Content not found" }, { status: 404 });
    if (!account) return NextResponse.json({ ok: false, error: "Account not found" }, { status: 404 });

    if (account.publishPermission === "ANALYZE_ONLY" || account.publishPermission === "DRAFT_ONLY") {
      return NextResponse.json({
        ok: false,
        error: `Account permission is ${account.publishPermission}.`,
      }, { status: 403 });
    }

    if (account.publishPermission === "APPROVAL_REQUIRED" && !approved && content.status !== "READY") {
      return NextResponse.json({
        ok: false,
        pendingApproval: true,
        error: "Approval required before publish.",
      }, { status: 409 });
    }

    if (account.connectionState !== "CONNECTED") {
      return NextResponse.json({
        ok: false,
        manual: true,
        error: "Unavailable through current connection. Publish on the platform, then mark it published here.",
      }, { status: 503 });
    }

    const payload = {
      ...buildPublishJobPayload(content, account, scheduledAt),
      approved: approved || account.publishPermission === "AUTO_PUBLISH" || content.status === "READY",
    };
    const job = await enqueuePublish(payload);
    let processed = null;
    if (runNow) {
      processed = await processJobQueue({ limit: 3, types: [JOB_TYPES.PUBLISH_CONTENT] });
    }
    return NextResponse.json({ ok: true, job, processed });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
