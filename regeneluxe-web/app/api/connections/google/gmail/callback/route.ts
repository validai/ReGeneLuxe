import { NextResponse } from "next/server";
import { publicAppOrigin } from "../../../../../../server/auth/origin.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = publicAppOrigin();
  const incoming = new URL(request.url);
  return NextResponse.redirect(new URL(`/api/oauth/gmail/callback${incoming.search}`, origin));
}
