import { isEmailAllowed } from "./allowlist.js";
import { initDb } from "../db/index.js";
import { upsertOperatorFromGoogle } from "../db/operatorRepository.js";
import { adoptWorkspaceForAccount } from "../db/workspaceAdoption.js";

/**
 * ReGeneLuxe account Google login. Identity scopes only.
 * Gmail and YouTube add incremental scopes later and must match this Google sub.
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
    const adoption = await adoptWorkspaceForAccount(operator);
    const next = adoption.adopted
      ? { ...operator, activeProfileId: adoption.profiles[0]?.id || operator.activeProfileId }
      : operator;
    return { ok: true, operator: next, account: next, adoption };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: "database_unavailable",
      message,
    };
  }
}
