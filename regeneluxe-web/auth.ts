import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";
import {
  authorizeGoogleSignIn,
  authorizeVerifiedIdentity,
} from "./server/auth/authorizeVerifiedIdentity.js";
import { findOperatorByGoogleSub, getOperator } from "./server/db/operatorRepository.js";
import { operatorHasAppAccess } from "./server/auth/accessPolicy.js";
import {
  assertE2eSecret,
  isE2eAuthEnabled,
  isE2eDisposableEmail,
} from "./server/auth/e2eAuthGate.js";

function logAuthError(error: unknown) {
  const err = error as {
    type?: string;
    name?: string;
    message?: string;
    cause?: { message?: string; err?: { message?: string; error?: string }; error?: string };
  };
  const name = err?.type || err?.name || "AuthError";
  const message = String(err?.message || "").replace(/\s*Read more at \S+/g, "").trim();
  const cause = err?.cause?.err?.message || err?.cause?.message || err?.cause?.err?.error || err?.cause?.error || "";
  console.error("[auth]", name, message, cause);
}

function buildProviders(): NextAuthConfig["providers"] {
  const providers: NextAuthConfig["providers"] = [...(authConfig.providers || [])];
  if (!isE2eAuthEnabled()) return providers;

  providers.push(
    Credentials({
      id: "e2e-verified",
      name: "E2E Verified Identity",
      credentials: {
        email: { label: "Email", type: "text" },
        sub: { label: "Sub", type: "text" },
        name: { label: "Name", type: "text" },
        secret: { label: "Secret", type: "password" },
      },
      async authorize(credentials) {
        if (!isE2eAuthEnabled()) return null;
        const secret = String(credentials?.secret || "");
        const email = String(credentials?.email || "");
        const sub = String(credentials?.sub || "");
        if (!assertE2eSecret(secret)) return null;
        if (!isE2eDisposableEmail(email)) return null;
        if (!sub.startsWith("e2e_")) return null;

        const result = await authorizeVerifiedIdentity({
          email,
          sub,
          emailVerified: true,
          name: String(credentials?.name || "E2E Profile"),
          avatarUrl: "",
        });
        if (!result.ok || !result.operator) return null;
        return {
          id: result.operator.id,
          email: result.operator.email,
          name: result.operator.name || "E2E Profile",
          image: result.operator.avatarUrl || null,
        };
      },
    }) as never,
  );
  return providers;
}

export const authOptions = {
  ...authConfig,
  providers: buildProviders(),
  logger: {
    error(error: Error) {
      logAuthError(error);
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({
      account,
      profile,
      user,
    }: {
      account?: { provider?: string; providerAccountId?: string } | null;
      profile?: { sub?: string; email?: string; name?: string; picture?: string } | null;
      user?: { id?: string } | null;
    }) {
      if (account?.provider === "e2e-verified") {
        return Boolean(user?.id) && isE2eAuthEnabled();
      }
      const result = await authorizeGoogleSignIn({ account, profile });
      if (result.ok) return true;
      if (result.reason === "not_authorized" || result.reason === "not_allowlisted") {
        return "/access-not-authorized?reason=not_authorized";
      }
      if (result.reason === "identity_mismatch") return "/access-not-authorized?reason=identity_mismatch";
      if (result.reason === "database_unavailable") return "/signin?error=database";
      return false;
    },
    async jwt({
      token,
      account,
      profile,
      user,
    }: {
      token: { operatorId?: string | null; email?: unknown; name?: unknown; picture?: unknown };
      account?: { provider?: string; providerAccountId?: string } | null;
      profile?: { sub?: string; email?: string; name?: string; picture?: string } | null;
      user?: { id?: string; email?: string | null; name?: string | null; image?: string | null } | null;
    }) {
      if (account?.provider === "e2e-verified" && user?.id) {
        token.operatorId = user.id;
        token.email = user.email || token.email;
        token.name = user.name || token.name;
        token.picture = user.image || token.picture;
      } else if (account && profile) {
        const sub = String(profile.sub || account.providerAccountId || "");
        const operator = sub ? await findOperatorByGoogleSub(sub) : null;
        token.operatorId = operator?.id || null;
        token.email = operator?.email || profile.email || token.email;
        token.name = operator?.name || profile.name || token.name;
        token.picture = operator?.avatarUrl || profile.picture || token.picture;
      }
      if (typeof token.operatorId === "string") {
        const operator = await getOperator(token.operatorId);
        if (!(operator && operatorHasAppAccess(operator))) {
          token.operatorId = null;
        }
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
