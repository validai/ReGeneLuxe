import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const origin = process.env.RL_PUBLIC_ORIGIN || process.env.AUTH_URL || "http://127.0.0.1:5174";
  const incoming = new URL(request.url);
  return NextResponse.redirect(new URL(`/api/oauth/gmail/callback${incoming.search}`, origin));
}
