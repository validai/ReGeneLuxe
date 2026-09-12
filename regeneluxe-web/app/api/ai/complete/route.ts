import { NextResponse } from "next/server";
import { complete } from "../../../../server/ai.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const result = await complete(body);
  return NextResponse.json(result.body, { status: result.status });
}
