import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

/**
 * Next.js 16 request proxy (replaces middleware.ts).
 * Edge-safe: imports auth.config only — never SQLite/libsql.
 *
 * Google redirect_uri is canonicalized in `app/api/auth/[...nextauth]/route.ts`
 * because Next.js NextURL rewrites 127.0.0.1 → localhost on NextRequest.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.webmanifest$).*)",
  ],
};
