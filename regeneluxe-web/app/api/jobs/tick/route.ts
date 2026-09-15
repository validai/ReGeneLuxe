import { NextResponse } from "next/server";
import { initDb } from "../../../../server/db/index.js";
import { processJobQueue } from "../../../../server/jobs/worker.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json().catch(() => ({}));
    const result = await processJobQueue({
      limit: Math.min(Number(body.limit) || 5, 20),
      types: Array.isArray(body.types) ? body.types : null,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}

export async function GET() {
  return POST(new Request("http://local", { method: "POST", body: "{}" }));
}
