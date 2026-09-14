import { NextResponse } from "next/server";
import { initDb, migrateLocalStorageDump } from "../../../../server/db/index.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await initDb();
    const body = await request.json();
    const dump = body?.dump && typeof body.dump === "object" ? body.dump : body;
    const result = await migrateLocalStorageDump(dump);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
