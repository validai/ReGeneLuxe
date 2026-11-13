import { initDb } from "../db/index.js";
import { upsertOperatorFromGoogle, updateOperator } from "../db/operatorRepository.js";
import {
  evaluateAppAccess,
  operatorHasAppAccess,
  APP_ACCESS_ALLOWLIST,
  APP_ACCESS_LOCAL,
  APP_ACCESS_PUBLIC,
} from "./accessPolicy.js";

/**
 * Shared post-verification identity admission.
 * Used by real Google OAuth and the test-only E2E harness.
 *
 * Does NOT adopt another owner's workspace.
 * Does NOT create profile-to-profile relationships.
 *
 * @param {{
 *   email?: string,
 *   sub?: string,
 *   emailVerified?: boolean,
 *   name?: string,
 *   avatarUrl?: string,
 *   env?: NodeJS.ProcessEnv,
 * }} [args]
 */
export async function authorizeVerifiedIdentity({
  email,
  sub,
  emailVerified = true,
  name = "",
  avatarUrl = "",
  env = process.env,
} = {}) {
  const googleSub = String(sub || "").trim();
  const rawEmail = String(email || "").trim();
  if (!googleSub) return { ok: false, reason: "missing_sub" };

  const access = evaluateAppAccess(rawEmail, { env });
  if (!access.ok) {
    return { ok: false, reason: access.reason || "not_authorized", mode: access.mode };
  }

  try {
    await initDb();
    let operator = await upsertOperatorFromGoogle({
      googleSub,
      email: rawEmail,
      emailVerified: Boolean(emailVerified),
      name,
      avatarUrl,
    });

    const grant = access.via === APP_ACCESS_LOCAL
      ? APP_ACCESS_LOCAL
      : access.via === APP_ACCESS_PUBLIC
        ? APP_ACCESS_PUBLIC
        : APP_ACCESS_ALLOWLIST;

    if (
      operator.appAccessGrant !== grant
      || operator.pilotAccessGrant === "PROFILE_INVITE"
    ) {
      operator = await updateOperator(operator.id, {
        appAccessGrant: grant,
        // Clear obsolete profile-invite grant marker if present.
        pilotAccessGrant: grant === APP_ACCESS_ALLOWLIST ? "ALLOWLIST" : grant,
      }) || operator;
    }

    if (!operatorHasAppAccess(operator, { env })) {
      return { ok: false, reason: "not_authorized", mode: access.mode };
    }

    return {
      ok: true,
      operator,
      account: operator,
      accessVia: access.via,
      mode: access.mode,
      adoption: { adopted: false, reason: "disabled" },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: "database_unavailable", message };
  }
}

/**
 * Google OAuth adapter — identity scopes only.
 * @param {{
 *   account?: { provider?: string, providerAccountId?: string } | null,
 *   profile?: { sub?: string, email?: string, name?: string, picture?: string, email_verified?: boolean, emailVerified?: boolean } | null,
 *   env?: NodeJS.ProcessEnv,
 * }} [args]
 */
export async function authorizeGoogleSignIn({ account, profile, env = process.env } = {}) {
  if (account?.provider && account.provider !== "google" && account.provider !== "e2e-verified") {
    return { ok: false, reason: "unsupported_provider" };
  }
  return authorizeVerifiedIdentity({
    email: profile?.email,
    sub: profile?.sub || account?.providerAccountId,
    emailVerified: profile?.email_verified ?? profile?.emailVerified ?? true,
    name: profile?.name || "",
    avatarUrl: profile?.picture || "",
    env,
  });
}
