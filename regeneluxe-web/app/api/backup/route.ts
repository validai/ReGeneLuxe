import { NextResponse } from "next/server";
import {
  exportDatabaseSnapshot,
  importDatabaseSnapshot,
  initDb,
} from "../../../server/db/index.js";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await initDb();
    const snapshot = await exportDatabaseSnapshot();
    return NextResponse.json(snapshot);
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
    const body = await request.json();
    const result = await importDatabaseSnapshot(body);
    return NextResponse.json({ ...result, ok: result.ok !== false });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
