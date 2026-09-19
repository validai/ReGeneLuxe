import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const origin = process.env.RL_PUBLIC_ORIGIN || process.env.AUTH_URL || "http://127.0.0.1:5174";
  return NextResponse.redirect(new URL("/api/oauth/gmail/start", origin));
}
