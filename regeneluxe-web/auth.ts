import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { authConfig } from "./auth.config";
import { authorizeGoogleSignIn } from "./server/auth/authorizeGoogle.js";
import { findOperatorByGoogleSub } from "./server/db/operatorRepository.js";

function logAuthError(error: unknown) {
  const err = error as { type?: string; name?: string; cause?: { err?: { error?: string }; error?: string } };
  const name = err?.type || err?.name || "AuthError";
  const code = err?.cause?.err?.error || err?.cause?.error;
  console.error("[auth]", name, code || "");
}

export const authOptions = {
  ...authConfig,
  logger: {
    error(error: Error) {
      logAuthError(error);
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ account, profile }: { account?: { provider?: string; providerAccountId?: string } | null; profile?: { sub?: string; email?: string; name?: string; picture?: string } | null }) {
      const result = await authorizeGoogleSignIn({ account, profile });
      if (result.ok) return true;
      if (result.reason === "not_allowlisted") return "/access-not-authorized";
      if (result.reason === "database_unavailable") return "/signin?error=database";
      return false;
    },
    async jwt({
      token,
      account,
      profile,
    }: {
      token: { operatorId?: string | null; email?: unknown; name?: unknown; picture?: unknown };
      account?: { providerAccountId?: string } | null;
      profile?: { sub?: string; email?: string; name?: string; picture?: string } | null;
    }) {
      if (account && profile) {
        const sub = String(profile.sub || account.providerAccountId || "");
        const operator = sub ? await findOperatorByGoogleSub(sub) : null;
        token.operatorId = operator?.id || null;
        token.email = operator?.email || profile.email || token.email;
        token.name = operator?.name || profile.name || token.name;
        token.picture = operator?.avatarUrl || profile.picture || token.picture;
      }
      return token;
    },
    async session({ session, token }: { session: any; token: any }) {
      const operatorId = typeof token.operatorId === "string" ? token.operatorId : null;
      session.operatorId = operatorId;
      if (session.user) {
        session.user.id = operatorId || "";
        session.user.email = typeof token.email === "string" ? token.email : session.user.email;
        session.user.name = typeof token.name === "string" ? token.name : session.user.name;
        session.user.image = typeof token.picture === "string" ? token.picture : session.user.image;
      }
      return session;
    },
  },
} as unknown as NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authOptions);
