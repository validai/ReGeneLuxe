import { NextResponse } from "next/server";
import { publicAppOrigin } from "../../../../../../server/auth/origin.js";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = publicAppOrigin();
  return NextResponse.redirect(new URL("/api/oauth/youtube/start", origin));
}
