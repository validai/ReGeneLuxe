import { isEmailAllowed } from "./allowlist.js";
import { initDb } from "../db/index.js";
import { upsertOperatorFromGoogle } from "../db/operatorRepository.js";

/**
 * First login: verify allowlisted email, persist Google `sub`, return Operator.
 * Subsequent logins: same `sub` resolves the same Operator (email may change).
 */
export async function authorizeGoogleSignIn({ account, profile } = {}) {
  if (account?.provider && account.provider !== "google") {
    return { ok: false, reason: "unsupported_provider" };
  }

  const email = String(profile?.email || "").trim();
  const sub = String(profile?.sub || account?.providerAccountId || "").trim();
  const emailVerified = Boolean(profile?.email_verified ?? profile?.emailVerified);

  if (!sub) return { ok: false, reason: "missing_sub" };
  if (!isEmailAllowed(email)) return { ok: false, reason: "not_allowlisted" };

  try {
    await initDb();
    const operator = await upsertOperatorFromGoogle({
      googleSub: sub,
      email,
      emailVerified,
      name: profile?.name || "",
      avatarUrl: profile?.picture || "",
    });
    return { ok: true, operator };
  } catch (error) {
    return {
      ok: false,
      reason: "database_unavailable",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
