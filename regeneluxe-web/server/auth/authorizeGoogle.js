import { isEmailAllowed } from "./allowlist.js";
import { initDb } from "../db/index.js";
import { upsertOperatorFromGoogle, updateOperator } from "../db/operatorRepository.js";
import { adoptWorkspaceForAccount } from "../db/workspaceAdoption.js";
import { getWorkspaceForAccount } from "../db/managedProfileRepository.js";
import {
  evaluatePilotEmailAccess,
  consumeProfileInvite,
  PILOT_ACCESS_ALLOWLIST,
  PILOT_ACCESS_PROFILE_INVITE,
} from "./profileInvite.js";

/**
 * ReGeneLuxe account Google login. Identity scopes only.
 * Gmail and YouTube add incremental scopes later and must match this Google sub.
 *
 * Access: pilot allowlist OR valid one-time operator profile invite.
 * createProfile URL flags are not authorization.
 */
export async function authorizeGoogleSignIn({ account, profile } = {}) {
  if (account?.provider && account.provider !== "google") {
    return { ok: false, reason: "unsupported_provider" };
  }

  const email = String(profile?.email || "").trim();
  const sub = String(profile?.sub || account?.providerAccountId || "").trim();
  const emailVerified = Boolean(profile?.email_verified ?? profile?.emailVerified);

  if (!sub) return { ok: false, reason: "missing_sub" };

  const access = await evaluatePilotEmailAccess(email);
  if (!access.ok) {
    return { ok: false, reason: access.reason || "not_allowlisted" };
  }

  try {
    await initDb();
    let operator = await upsertOperatorFromGoogle({
      googleSub: sub,
      email,
      emailVerified,
      name: profile?.name || "",
      avatarUrl: profile?.picture || "",
    });

    const grant = access.via === PILOT_ACCESS_PROFILE_INVITE
      ? PILOT_ACCESS_PROFILE_INVITE
      : (isEmailAllowed(email) ? PILOT_ACCESS_ALLOWLIST : operator.pilotAccessGrant || PILOT_ACCESS_ALLOWLIST);

    if (operator.pilotAccessGrant !== grant) {
      operator = await updateOperator(operator.id, { pilotAccessGrant: grant }) || operator;
    }

    if (access.via === PILOT_ACCESS_PROFILE_INVITE && access.invite?.id) {
      const workspace = await getWorkspaceForAccount(operator.id);
      if (workspace) {
        await consumeProfileInvite(access.invite.id, operator.id, "existing_workspace");
      }
    }

    const adoption = await adoptWorkspaceForAccount(operator);
    const next = adoption.adopted
      ? { ...operator, activeProfileId: adoption.profiles[0]?.id || operator.activeProfileId }
      : operator;
    return {
      ok: true,
      operator: next,
      account: next,
      adoption,
      accessVia: access.via,
      inviteId: access.invite?.id || null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: "database_unavailable",
      message,
    };
  }
}
