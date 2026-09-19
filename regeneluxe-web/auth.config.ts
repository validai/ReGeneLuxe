import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { isPublicPath } from "./server/auth/publicPaths.js";
import { getCanonicalOrigin, toCanonicalPath } from "./server/auth/origin.js";
import { OPERATOR_GOOGLE_SCOPES } from "./server/auth/googleScopes.js";
import { PILOT_GOOGLE_EMAIL } from "./src/data/googleIdentity.js";

/**
 * Edge-safe Auth.js config. Do not import SQLite/libsql here.
 * Google login requests only openid/profile/email — never Gmail or YouTube.
 */
export const authConfig = {
  trustHost: true,
  basePath: "/api/auth",
  pages: {
    signIn: "/signin",
    error: "/signin",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  providers: [
    Google({
      authorization: {
        params: {
          scope: OPERATOR_GOOGLE_SCOPES,
          prompt: "select_account",
          login_hint: PILOT_GOOGLE_EMAIL,
        },
      },
    }),
  ],
  callbacks: {
    authorized({ auth, request }) {
      if (isPublicPath(request.nextUrl.pathname)) return true;
      return Boolean(auth?.user);
    },
    redirect({ url }) {
      return toCanonicalPath(url, getCanonicalOrigin());
    },
  },
} satisfies NextAuthConfig;
