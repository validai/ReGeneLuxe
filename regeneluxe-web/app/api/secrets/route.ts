import { NextResponse } from "next/server";
import { setAiSecret } from "../../../server/secrets.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  if (body?.kind !== "ai") {
    return NextResponse.json({ ok: false, error: "Unsupported secret kind" }, { status: 400 });
  }
  const result = setAiSecret(body.provider, body.value);
  return NextResponse.json({ ok: true, ...result });
}
