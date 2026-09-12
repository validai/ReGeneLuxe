import { NextResponse } from "next/server";
import { publicStatus } from "../../../server/secrets.js";
import { SERVICE_NAME } from "../../../server/config.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ...publicStatus(), service: SERVICE_NAME });
}
